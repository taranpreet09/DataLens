import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { streamParseCSV, readAllRows, stratifiedSample } from './fileParser.js';
import { computeAllStats } from './statsEngine.js';
import Dataset from '../models/Dataset.js';

const QUEUE_NAME = 'dataset-processing';

let queue = null;
let worker = null;
let io = null; // Socket.IO instance, set via init

/**
 * Initialize the job queue with a Socket.IO instance for progress updates.
 */
export function initJobQueue(socketIO) {
  io = socketIO;

  const connection = getRedisConnection();

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(QUEUE_NAME, processJob, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 1000 },
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed: ${job.name}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Job queue initialized');
  return queue;
}

/**
 * Add a dataset processing job to the queue.
 */
export async function addProcessingJob(datasetId, userId, filePath, options = {}) {
  if (!queue) throw new Error('Job queue not initialized');

  const job = await queue.add('process-dataset', {
    datasetId,
    userId,
    filePath,
    options,
  }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  });

  return job.id;
}

/**
 * Process a dataset job: parse → compute stats → save.
 */
async function processJob(job) {
  const { datasetId, userId, filePath, options } = job.data;
  const LARGE_DATASET_THRESHOLD = 50000;

  const emitProgress = (stage, progress, message) => {
    if (io) {
      io.to(`user:${userId}`).emit('job:progress', {
        jobId: job.id,
        datasetId,
        stage,
        progress,
        message,
      });
    }
    job.updateProgress({ stage, progress, message });
  };

  try {
    // Stage 1: Parse CSV
    emitProgress('parsing', 10, 'Parsing file...');

    const parseResult = await streamParseCSV(filePath, datasetId, (rowsProcessed) => {
      const pct = Math.min(40, 10 + Math.round((rowsProcessed / 100000) * 30));
      emitProgress('parsing', pct, `Parsed ${rowsProcessed.toLocaleString()} rows...`);
    });

    const { headers, rowCount, parsedFilePath, sampleRows } = parseResult;

    emitProgress('parsing', 45, `Parsed ${rowCount.toLocaleString()} rows. Computing stats...`);

    // Stage 2: Compute stats
    // For large datasets, use stratified sampling
    let statsRows;
    if (rowCount > LARGE_DATASET_THRESHOLD) {
      emitProgress('stats', 50, `Large dataset (${rowCount.toLocaleString()} rows). Sampling for stats...`);
      statsRows = await stratifiedSample(parsedFilePath, 10000, rowCount);
    } else {
      statsRows = sampleRows.length === rowCount ? sampleRows : await readAllRows(parsedFilePath);
    }

    emitProgress('stats', 60, 'Computing statistics...');
    const stats = computeAllStats(headers, statsRows);

    emitProgress('stats', 85, 'Saving results...');

    // Stage 3: Update dataset in MongoDB (metadata + stats, NOT rows)
    await Dataset.findByIdAndUpdate(datasetId, {
      headers,
      rowCount,
      stats,
      parsedFilePath,
      status: 'ready',
      parseTime: Date.now() - job.timestamp,
    });

    emitProgress('complete', 100, 'Analysis complete!');

    // Emit completion event
    if (io) {
      io.to(`user:${userId}`).emit('job:completed', {
        jobId: job.id,
        datasetId,
        stats,
        headers,
        rowCount,
      });
    }

    return { datasetId, rowCount, headers: headers.length };
  } catch (err) {
    // Update dataset status to error
    await Dataset.findByIdAndUpdate(datasetId, {
      status: 'error',
      error: err.message,
    }).catch(() => {});

    if (io) {
      io.to(`user:${userId}`).emit('job:failed', {
        jobId: job.id,
        datasetId,
        error: err.message,
      });
    }

    throw err;
  }
}

export { queue };
