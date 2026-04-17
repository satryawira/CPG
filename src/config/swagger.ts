const pageQueryParams = [
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

const okResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { success: { type: 'boolean' }, data: {} } },
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string', nullable: true },
        },
      },
    },
  },
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Crypto Payment Gateway API',
    version: '1.0.0',
    description:
      'Platform cashout crypto \u2192 IDR. Login dulu di `/auth/login`, copy `accessToken`, klik **Authorize** (kanan atas), tempel token, lalu coba endpoint lain.\n\n**Seeded credentials**\n- Admin: `admin@cpg.dev` / `Admin123!`\n- User: `user@cpg.dev` / `User123!`',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'Auth', description: 'Register, login, refresh token, profile' },
    { name: 'KYC', description: 'KYC submission + document upload' },
    { name: 'Wallet', description: 'Crypto wallets & bank accounts' },
    { name: 'Cashout', description: 'Quote + submit cashout (crypto \u2192 IDR)' },
    { name: 'Admin', description: 'Admin-only: users, KYC review, fees, dashboard' },
    { name: 'Webhooks', description: 'Payment gateway callbacks (public)' },
    { name: 'System', description: 'Health & meta' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@cpg.dev' },
          password: { type: 'string', example: 'Admin123!' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string' },
          phone: { type: 'string' },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      VerifyEmailRequest: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: { fullName: { type: 'string' }, phone: { type: 'string' } },
      },
      SubmitKycRequest: {
        type: 'object',
        required: ['fullName', 'idNumber', 'dateOfBirth', 'address'],
        properties: {
          fullName: { type: 'string' },
          idNumber: { type: 'string', example: '3273011234567890' },
          dateOfBirth: { type: 'string', format: 'date', example: '1990-01-15' },
          address: { type: 'string' },
        },
      },
      CreateWalletRequest: {
        type: 'object',
        required: ['currency', 'network'],
        properties: {
          currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'], example: 'USDT' },
          network: {
            type: 'string',
            enum: ['NATIVE', 'ERC20', 'TRC20', 'BEP20', 'POLYGON'],
            example: 'TRC20',
          },
        },
      },
      AddBankAccountRequest: {
        type: 'object',
        required: ['bankCode', 'bankName', 'accountNumber', 'accountName'],
        properties: {
          bankCode: { type: 'string', example: 'BCA' },
          bankName: { type: 'string', example: 'Bank Central Asia' },
          accountNumber: { type: 'string', example: '1234567890' },
          accountName: { type: 'string', example: 'Budi Santoso' },
          isDefault: { type: 'boolean' },
        },
      },
      GetQuoteRequest: {
        type: 'object',
        required: ['currency', 'amount', 'network'],
        properties: {
          currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'], example: 'USDT' },
          amount: { type: 'string', example: '100' },
          network: { type: 'string', enum: ['NATIVE', 'ERC20', 'TRC20', 'BEP20', 'POLYGON'], example: 'TRC20' },
        },
      },
      SubmitCashoutRequest: {
        type: 'object',
        required: ['quoteId', 'bankAccountId'],
        properties: {
          quoteId: { type: 'string' },
          bankAccountId: { type: 'string' },
        },
      },
      UpdateUserStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] },
          reason: { type: 'string' },
        },
      },
      CreateFeeConfigRequest: {
        type: 'object',
        required: ['currency', 'type', 'feePercent'],
        properties: {
          currency: { type: 'string', enum: ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'] },
          type: { type: 'string', example: 'CASHOUT' },
          feePercent: { type: 'number', example: 0.015 },
          feeFlat: { type: 'number' },
          minFee: { type: 'number' },
          maxFee: { type: 'number' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { '200': okResponse('Service up') },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register new user',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: { '201': okResponse('Registered'), '409': errorResponse('Email exists') },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login \u2014 returns accessToken + refreshToken',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: { '200': okResponse('Tokens + user'), '401': errorResponse('Invalid credentials') },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: { '200': okResponse('New token pair') },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (revoke session)',
        responses: { '200': okResponse('Logged out') },
      },
    },
    '/api/v1/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email with token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailRequest' } } },
        },
        responses: { '200': okResponse('Verified') },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user profile',
        responses: { '200': okResponse('Profile') },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update profile (fullName, phone)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
        },
        responses: { '200': okResponse('Updated') },
      },
    },
    '/api/v1/kyc': {
      get: {
        tags: ['KYC'],
        summary: 'Get my KYC status',
        responses: { '200': okResponse('KYC record') },
      },
    },
    '/api/v1/kyc/submit': {
      post: {
        tags: ['KYC'],
        summary: 'Submit KYC data for review',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmitKycRequest' } } },
        },
        responses: { '200': okResponse('Submitted'), '400': errorResponse('Validation error') },
      },
    },
    '/api/v1/kyc/documents': {
      post: {
        tags: ['KYC'],
        summary: 'Upload a KYC document (multipart)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  documentType: { type: 'string', enum: ['ID_CARD', 'SELFIE', 'ADDRESS_PROOF'] },
                },
              },
            },
          },
        },
        responses: { '201': okResponse('Uploaded') },
      },
    },
    '/api/v1/wallets': {
      get: { tags: ['Wallet'], summary: 'List my wallets', responses: { '200': okResponse('Wallets') } },
      post: {
        tags: ['Wallet'],
        summary: 'Create wallet (currency + network)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateWalletRequest' } } },
        },
        responses: { '201': okResponse('Wallet created') },
      },
    },
    '/api/v1/wallets/bank-accounts': {
      get: { tags: ['Wallet'], summary: 'List bank accounts', responses: { '200': okResponse('Bank accounts') } },
      post: {
        tags: ['Wallet'],
        summary: 'Add bank account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddBankAccountRequest' } } },
        },
        responses: { '201': okResponse('Created') },
      },
    },
    '/api/v1/wallets/bank-accounts/{id}': {
      delete: {
        tags: ['Wallet'],
        summary: 'Delete bank account',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Deleted') },
      },
    },
    '/api/v1/wallets/{walletId}': {
      get: {
        tags: ['Wallet'],
        summary: 'Get wallet by id',
        parameters: [{ in: 'path', name: 'walletId', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Wallet') },
      },
    },
    '/api/v1/wallets/{walletId}/address': {
      get: {
        tags: ['Wallet'],
        summary: 'Get deposit address',
        parameters: [{ in: 'path', name: 'walletId', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Address') },
      },
    },
    '/api/v1/wallets/{walletId}/transactions': {
      get: {
        tags: ['Wallet'],
        summary: 'List wallet transactions',
        parameters: [
          { in: 'path', name: 'walletId', required: true, schema: { type: 'string' } },
          ...pageQueryParams,
        ],
        responses: { '200': okResponse('Transactions') },
      },
    },
    '/api/v1/cashouts/quote': {
      post: {
        tags: ['Cashout'],
        summary: 'Get cashout quote (requires approved KYC)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GetQuoteRequest' } } },
        },
        responses: {
          '200': okResponse('Quote with rate, fees, net IDR'),
          '503': errorResponse('Exchange unavailable (no API key in dev)'),
        },
      },
    },
    '/api/v1/cashouts': {
      post: {
        tags: ['Cashout'],
        summary: 'Submit cashout (uses quoteId + bankAccountId)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmitCashoutRequest' } } },
        },
        responses: { '201': okResponse('Queued') },
      },
      get: {
        tags: ['Cashout'],
        summary: 'List my cashouts',
        parameters: pageQueryParams,
        responses: { '200': okResponse('Cashouts') },
      },
    },
    '/api/v1/cashouts/{id}': {
      get: {
        tags: ['Cashout'],
        summary: 'Get cashout by id',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Cashout') },
      },
      delete: {
        tags: ['Cashout'],
        summary: 'Cancel pending cashout',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Cancelled') },
      },
    },
    '/api/v1/admin/stats': {
      get: { tags: ['Admin'], summary: 'Dashboard stats', responses: { '200': okResponse('Stats') } },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        parameters: [
          ...pageQueryParams,
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'role', schema: { type: 'string' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
        ],
        responses: { '200': okResponse('Users') },
      },
    },
    '/api/v1/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get user',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('User') },
      },
    },
    '/api/v1/admin/users/{id}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Update user status',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserStatusRequest' } } },
        },
        responses: { '200': okResponse('Updated') },
      },
    },
    '/api/v1/admin/kyc': {
      get: {
        tags: ['Admin'],
        summary: 'List KYC records',
        parameters: [
          ...pageQueryParams,
          { in: 'query', name: 'status', schema: { type: 'string' } },
        ],
        responses: { '200': okResponse('KYC list') },
      },
    },
    '/api/v1/admin/kyc/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get KYC record',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('KYC') },
      },
    },
    '/api/v1/admin/kyc/{id}/approve': {
      patch: {
        tags: ['Admin'],
        summary: 'Approve KYC',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': okResponse('Approved') },
      },
    },
    '/api/v1/admin/kyc/{id}/reject': {
      patch: {
        tags: ['Admin'],
        summary: 'Reject KYC',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { notes: { type: 'string' } } },
            },
          },
        },
        responses: { '200': okResponse('Rejected') },
      },
    },
    '/api/v1/admin/cashouts': {
      get: {
        tags: ['Admin'],
        summary: 'List all cashouts',
        parameters: [
          ...pageQueryParams,
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'userId', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': okResponse('Cashouts') },
      },
    },
    '/api/v1/admin/fees': {
      get: { tags: ['Admin'], summary: 'List fee configs', responses: { '200': okResponse('Fees') } },
      post: {
        tags: ['Admin'],
        summary: 'Create fee config',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFeeConfigRequest' } } },
        },
        responses: { '201': okResponse('Created') },
      },
    },
    '/api/v1/admin/fees/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update fee config',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  feePercent: { type: 'number' },
                  feeFlat: { type: 'number' },
                  minFee: { type: 'number' },
                  maxFee: { type: 'number' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { '200': okResponse('Updated') },
      },
    },
    '/api/v1/webhooks/flip': {
      post: {
        tags: ['Webhooks'],
        summary: 'Flip disbursement callback',
        security: [],
        responses: { '200': okResponse('Received') },
      },
    },
    '/api/v1/webhooks/xendit': {
      post: {
        tags: ['Webhooks'],
        summary: 'Xendit disbursement callback',
        security: [],
        responses: { '200': okResponse('Received') },
      },
    },
    '/api/v1/webhooks/midtrans': {
      post: {
        tags: ['Webhooks'],
        summary: 'Midtrans payout callback',
        security: [],
        responses: { '200': okResponse('Received') },
      },
    },
  },
};
