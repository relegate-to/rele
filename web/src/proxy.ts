import { auth } from '@/lib/auth-server';

export default auth.middleware({ loginUrl: '/sign-in' });

export const config = {
  matcher: [
    '/console/:path*',
    '/api/((?!gate/).*)',
  ],
};
