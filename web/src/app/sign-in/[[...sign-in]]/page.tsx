import { auth } from '@/lib/auth-server';
import { redirect } from 'next/navigation';
import SignInPageClient from './sign-in-page';

export default async function SignInPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) redirect('/home');
  return <SignInPageClient />;
}
