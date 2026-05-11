import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directories
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '..', 'storage');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
const PARSED_DIR = path.join(STORAGE_ROOT, 'parsed');
const CACHE_DIR = path.join(STORAGE_ROOT, 'cache');

// Ensure directories exist
[STORAGE_ROOT, UPLOADS_DIR, PARSED_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export { STORAGE_ROOT, UPLOADS_DIR, PARSED_DIR, CACHE_DIR };
