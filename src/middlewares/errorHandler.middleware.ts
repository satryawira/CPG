import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/utils/AppError';
import { logger } from '@/config/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
