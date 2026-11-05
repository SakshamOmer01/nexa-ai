import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Nexa AI account with an email and password.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Passwords are hashed with Argon2id and sessions are signed JWTs stored in an httpOnly cookie."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
