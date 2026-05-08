import { createNeonAuth } from '@neondatabase/auth/next/server';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your deployment environment (and .env.local for development).`,
    );
  }
  return value;
}

export const auth = createNeonAuth({
  baseUrl: requireEnv('NEON_AUTH_BASE_URL'),
  cookies: {
    secret: requireEnv('NEON_AUTH_COOKIE_SECRET'),
  },
});
