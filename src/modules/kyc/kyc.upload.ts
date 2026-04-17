import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/config/env';
import { AppError, HttpStatus } from '@/utils/AppError';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const localStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = env.UPLOAD_DIR;
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const kycUpload = multer({
  storage: localStorage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(new AppError('Only JPEG, PNG, WebP and PDF files are allowed', HttpStatus.BAD_REQUEST));
      return;
    }
    cb(null, true);
  },
});
