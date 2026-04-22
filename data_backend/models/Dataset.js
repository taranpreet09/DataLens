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
    rows: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

const Dataset = mongoose.model('Dataset', datasetSchema);
export default Dataset;