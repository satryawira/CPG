import { z } from 'zod';

export const submitKycSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100),
    idNumber: z.string().min(16).max(20),
    dateOfBirth: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }),
    address: z.string().min(10).max(500),
  }),
});

export const uploadDocumentSchema = z.object({
  params: z.object({}),
  query: z.object({
    type: z.enum(['KTP', 'PASSPORT', 'SELFIE', 'NPWP']),
  }),
});

export type SubmitKycDto = z.infer<typeof submitKycSchema>['body'];
