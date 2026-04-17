import { Request, Response, NextFunction } from 'express';
import { AppError, HttpStatus } from '@/utils/AppError';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED);
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
    throw new AppError('Admin access required', HttpStatus.FORBIDDEN);
  }

  next();
}
