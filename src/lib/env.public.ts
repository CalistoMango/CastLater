import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  PAYMENT_RECEIVER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'PAYMENT_RECEIVER_ADDRESS must be a valid EVM address'),
});

const parsedPublicEnv = publicEnvSchema.safeParse({
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  PAYMENT_RECEIVER_ADDRESS: process.env.PAYMENT_RECEIVER_ADDRESS,
});

if (!parsedPublicEnv.success) {
  const flattened = parsedPublicEnv.error.flatten();
  const details = {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
  console.error('❌ Missing required public environment variables:', details);
  throw new Error('Public environment validation failed. Check the logs above for details.');
}

export const publicEnv = parsedPublicEnv.data;
