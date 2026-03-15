import { auth } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import SignUpPageClient from './sign-up-page';

export default async function SignUpPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) redirect('/home');
  return <SignUpPageClient />;
}
