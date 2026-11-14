import type { Metadata } from "next";
import { Stethoscope } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Doctor Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage doctors and patients.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
