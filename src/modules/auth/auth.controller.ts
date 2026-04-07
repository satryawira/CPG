import { Request, Response } from 'express';
import * as authService from './auth.service';
import { successResponse } from '@/utils/response.util';

export async function registerHandler(req: Request, res: Response) {
  const result = await authService.register(req.body, req.ip);
  successResponse(res, result, 201, result.message);
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body, req.ip, req.headers['user-agent']);
  successResponse(res, result);
}

export async function refreshHandler(req: Request, res: Response) {
  const result = await authService.refreshTokens(req.body.refreshToken);
  successResponse(res, result);
}

export async function logoutHandler(req: Request, res: Response) {
  await authService.logout(req.user!.id, req.body.refreshToken);
  successResponse(res, null, 200, 'Logged out successfully');
}

export async function verifyEmailHandler(req: Request, res: Response) {
  const result = await authService.verifyEmail(req.body.email, req.body.otp);
  successResponse(res, result);
}

export async function getMeHandler(req: Request, res: Response) {
  const user = await authService.getProfile(req.user!.id);
  successResponse(res, user);
}

export async function updateMeHandler(req: Request, res: Response) {
  const user = await authService.updateProfile(req.user!.id, req.body);
  successResponse(res, user);
}
