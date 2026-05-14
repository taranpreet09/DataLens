import mongoose from 'mongoose';

// ─── Intelligence Layer sub-schemas ──────────────────────────────────────────

const NarrativeSchema = new mongoose.Schema(
  {
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
    fullMarkdown: { type: String, default: '' },
    tone: { type: String, enum: ['executive', 'technical'], default: 'executive' },
    model: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EdaReportSchema = new mongoose.Schema(
  {
    etag: { type: String, default: '' },
    profile: { type: mongoose.Schema.Types.Mixed, default: null },
    plots: { type: mongoose.Schema.Types.Mixed, default: {} },
    narrative: { type: mongoose.Schema.Types.Mixed, default: {} },
    fullMarkdown: { type: String, default: '' },
    samplingApplied: { type: mongoose.Schema.Types.Mixed, default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────

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

    // Intelligence Layer
    narrative: { type: NarrativeSchema, default: null },
    edaReport: { type: EdaReportSchema, default: null },

    // Sharing (Phase 6)
    shareToken: { type: String, default: null, unique: true, sparse: true },
    shareEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast user-scoped queries
datasetSchema.index({ userId: 1, createdAt: -1 });
datasetSchema.index({ status: 1 });

const Dataset = mongoose.model('Dataset', datasetSchema);
export default Dataset;
