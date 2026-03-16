import { auth } from '@/lib/auth-server';

export default auth.middleware({ loginUrl: '/sign-in' });

export const config = {
  matcher: [
    '/home/:path*',
    '/api/:path*',
  ],
};
