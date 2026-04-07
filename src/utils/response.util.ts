import { Response } from 'express';

export function successResponse<T>(res: Response, data: T, statusCode = 200, message?: string) {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Success',
    data,
  });
}

export function errorResponse(res: Response, message: string, statusCode = 500, errors?: unknown) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
