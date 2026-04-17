import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/config/database';
import { redis, REDIS_KEYS } from '@/config/redis';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt.util';
import { AppError, HttpStatus } from '@/utils/AppError';
import { generateOtp } from '@/utils/crypto.util';
import { env } from '@/config/env';
import type { RegisterDto, LoginDto } from './auth.dto';

const BCRYPT_ROUNDS = 12;
const OTP_TTL = 600; // 10 minutes

export async function register(dto: RegisterDto, ipAddress?: string) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) {
    throw new AppError('Email already registered', HttpStatus.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      kyc: { create: {} },
    },
    select: { id: true, email: true, fullName: true, role: true, emailVerified: true, createdAt: true },
  });

  // Generate and cache OTP
  const otp = generateOtp();
  await redis.setex(REDIS_KEYS.emailOtp(dto.email), OTP_TTL, otp);

  // TODO: Send OTP via email (nodemailer)
  if (env.NODE_ENV === 'development') {
    console.log(`[DEV] OTP for ${dto.email}: ${otp}`);
  }

  return { user, message: 'Registration successful. Please verify your email.' };
}

export async function login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    throw new AppError('Invalid email or password', HttpStatus.UNAUTHORIZED);
  }

  if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
    throw new AppError('Account suspended or banned', HttpStatus.FORBIDDEN);
  }

  const jti = uuidv4();
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role, jti });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.session.create({
    data: { userId: user.id, refreshToken, ipAddress, userAgent, expiresAt },
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, emailVerified: user.emailVerified },
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({ where: { refreshToken } });
  if (!session || session.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', HttpStatus.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('User not found or inactive', HttpStatus.UNAUTHORIZED);
  }

  // Rotate refresh token
  const newJti = uuidv4();
  const newAccessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const newRefreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role, jti: newJti });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: newRefreshToken, expiresAt },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string, refreshToken: string) {
  await prisma.session.deleteMany({ where: { userId, refreshToken } });
}

export async function verifyEmail(email: string, otp: string) {
  const cachedOtp = await redis.get(REDIS_KEYS.emailOtp(email));
  if (!cachedOtp || cachedOtp !== otp) {
    throw new AppError('Invalid or expired OTP', HttpStatus.BAD_REQUEST);
  }

  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  await redis.del(REDIS_KEYS.emailOtp(email));

  return { message: 'Email verified successfully' };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, phone: true, role: true, status: true, emailVerified: true, phoneVerified: true, createdAt: true },
  });

  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND);
  return user;
}

export async function updateProfile(userId: string, data: { fullName?: string; phone?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, fullName: true, phone: true },
  });
  return user;
}
