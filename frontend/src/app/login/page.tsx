import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Nexa AI account.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in with your email and password to access your Nexa AI account."
      footer={
        <>
          New to Nexa AI?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
