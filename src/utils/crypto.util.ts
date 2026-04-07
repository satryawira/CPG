import CryptoJS from 'crypto-js';
import { env } from '@/config/env';

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, env.ENCRYPTION_KEY).toString();
}

export function decrypt(cipherText: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export function hmacSha256(data: string, secret: string): string {
  return CryptoJS.HmacSHA256(data, secret).toString(CryptoJS.enc.Hex);
}

export function hmacSha512(data: string, secret: string): string {
  return CryptoJS.HmacSHA512(data, secret).toString(CryptoJS.enc.Hex);
}
