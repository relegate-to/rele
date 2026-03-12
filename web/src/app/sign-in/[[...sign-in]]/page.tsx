import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import SignInPageClient from "./sign-in-page";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/home");
  return <SignInPageClient />;
}
