import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/utils/jwt.util';
import { AppError, HttpStatus } from '@/utils/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization token required', HttpStatus.UNAUTHORIZED);
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);

  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role as never,
  };

  next();
}
