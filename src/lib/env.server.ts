import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    NEXT_PUBLIC_URL: z.string().url(),
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
    SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
    PAYMENT_RECEIVER_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'PAYMENT_RECEIVER_ADDRESS must be a valid EVM address'),
    KV_REST_API_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    NEYNAR_API_KEY: z.string().min(1, 'NEYNAR_API_KEY is required'),
    NEYNAR_CLIENT_ID: z.string().min(1, 'NEYNAR_CLIENT_ID is required'),
    CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
    SPONSOR_SIGNER: z.enum(['true', 'false']).default('false'),
    SEED_PHRASE: z.string().min(1, 'SEED_PHRASE is required'),
    FARCASTER_DEVELOPER_FID: z
      .preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return undefined;
          }
          const trimmed = value.trim();
          if (trimmed === '') {
            return undefined;
          }
          if (!/^\d+$/.test(trimmed)) {
            return undefined;
          }
          return Number.parseInt(trimmed, 10);
        },
        z.number().optional()
      ),
    SOLANA_RPC_ENDPOINT: z.string().url().optional(),
    USE_TUNNEL: z.enum(['true', 'false']).optional(),
    VERCEL_ENV: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    PORT: z
      .union([z.string().regex(/^\d+$/), z.number()])
      .transform((value) => Number(value))
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.KV_REST_API_URL && !env.KV_REST_API_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KV_REST_API_TOKEN'],
        message: 'KV_REST_API_TOKEN is required when KV_REST_API_URL is set',
      });
    }

    if (env.KV_REST_API_TOKEN && !env.KV_REST_API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KV_REST_API_URL'],
        message: 'KV_REST_API_URL is required when KV_REST_API_TOKEN is set',
      });
    }

  });

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  PAYMENT_RECEIVER_ADDRESS: process.env.PAYMENT_RECEIVER_ADDRESS,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
  NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID,
  CRON_SECRET: process.env.CRON_SECRET,
  SPONSOR_SIGNER: process.env.SPONSOR_SIGNER,
  SEED_PHRASE: process.env.SEED_PHRASE,
  FARCASTER_DEVELOPER_FID: process.env.FARCASTER_DEVELOPER_FID,
  SOLANA_RPC_ENDPOINT: process.env.SOLANA_RPC_ENDPOINT,
  USE_TUNNEL: process.env.USE_TUNNEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  PORT: process.env.PORT,
} satisfies Record<string, unknown>;

const cleanedEnv = Object.fromEntries(
  Object.entries(rawEnv).map(([key, value]) => [
    key,
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  ])
) as typeof rawEnv;

const parsedEnv = envSchema.safeParse(cleanedEnv);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Environment validation failed. Check the logs above for details.');
}

export const env = parsedEnv.data;
