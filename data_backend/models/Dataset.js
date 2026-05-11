import mongoose from 'mongoose';

const datasetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    ext: { type: String, default: 'csv' },
    rowCount: { type: Number, default: 0 },
    headers: [{ type: String }],
    stats: { type: mongoose.Schema.Types.Mixed, default: null },
    parseTime: { type: Number, default: 0 },

    // File-based storage (Phase 1)
    uploadPath: { type: String, default: null },     // Path to original uploaded file
    parsedFilePath: { type: String, default: null },  // Path to parsed JSONL file
    status: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'error', 'saved'],
      default: 'uploading',
    },
    error: { type: String, default: null },
    jobId: { type: String, default: null },

    // Legacy: rows stored in DB (for backward compatibility with existing data)
    rows: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Index for fast user-scoped queries
datasetSchema.index({ userId: 1, createdAt: -1 });
datasetSchema.index({ status: 1 });

const Dataset = mongoose.model('Dataset', datasetSchema);
export default Dataset;
