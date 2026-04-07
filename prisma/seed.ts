import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ───────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cpg.dev' },
    update: {},
    create: {
      email: 'admin@cpg.dev',
      passwordHash: adminPassword,
      fullName: 'Admin CPG',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      kyc: { create: { status: 'APPROVED', approvedAt: new Date() } },
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Regular User (KYC Approved) ──────────────────────────────────────────
  const userPassword = await bcrypt.hash('User123!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@cpg.dev' },
    update: {},
    create: {
      email: 'user@cpg.dev',
      passwordHash: userPassword,
      fullName: 'Budi Santoso',
      phone: '081234567890',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      kyc: {
        create: {
          status: 'APPROVED',
          fullName: 'Budi Santoso',
          idNumber: '3273011234567890',
          dateOfBirth: new Date('1990-01-15'),
          address: 'Jl. Sudirman No. 1, Jakarta Pusat, DKI Jakarta 10220',
          approvedAt: new Date(),
        },
      },
    },
  });
  console.log(`✅ Regular user: ${user.email}`);

  // ─── USDT Wallet for test user ────────────────────────────────────────────
  const wallet = await prisma.wallet.upsert({
    where: { userId_currency_network: { userId: user.id, currency: 'USDT', network: 'TRC20' } },
    update: {},
    create: {
      userId: user.id,
      currency: 'USDT',
      network: 'TRC20',
      balance: 500, // 500 USDT
      depositAddress: 'TTest1234567890AbCdEfGhIjKlMnOpQrSt',
    },
  });
  console.log(`✅ USDT wallet: ${wallet.balance} USDT (TRC20)`);

  // BTC wallet
  await prisma.wallet.upsert({
    where: { userId_currency_network: { userId: user.id, currency: 'BTC', network: 'NATIVE' } },
    update: {},
    create: {
      userId: user.id,
      currency: 'BTC',
      network: 'NATIVE',
      balance: 0.01,
      depositAddress: '1TestBtcAddressForDevOnly1234567890',
    },
  });
  console.log(`✅ BTC wallet created`);

  // ─── Bank Account for test user ───────────────────────────────────────────
  await prisma.bankAccount.upsert({
    where: { userId_bankCode_accountNumber: { userId: user.id, bankCode: 'BCA', accountNumber: '1234567890' } },
    update: {},
    create: {
      userId: user.id,
      bankCode: 'BCA',
      bankName: 'Bank Central Asia',
      accountNumber: '1234567890',
      accountName: 'Budi Santoso',
      isDefault: true,
      isVerified: true,
    },
  });
  console.log(`✅ Bank account: BCA 1234567890`);

  // ─── Fee Configs ──────────────────────────────────────────────────────────
  const currencies = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'] as const;
  for (const currency of currencies) {
    await prisma.feeConfig.upsert({
      where: { currency_type: { currency, type: 'CASHOUT' } },
      update: {},
      create: {
        currency,
        type: 'CASHOUT',
        feePercent: 0.015,    // 1.5%
        feeFlat: 5000,        // Rp 5.000 flat
        minFee: 10000,        // min Rp 10.000
        maxFee: 500000,       // max Rp 500.000
        isActive: true,
      },
    });
  }
  console.log(`✅ Fee configs created for ${currencies.join(', ')}`);

  console.log('\n🎉 Seed completed!');
  console.log('\n📋 Test Credentials:');
  console.log('  Admin  → email: admin@cpg.dev  | password: Admin123!');
  console.log('  User   → email: user@cpg.dev   | password: User123!');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
