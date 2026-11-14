import type { Metadata } from "next";
import { Activity, Stethoscope, UsersRound } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES = [
  { icon: Stethoscope, text: "Doctors, their specializations and caseloads in one directory" },
  { icon: UsersRound, text: "Patients from admission to recovery, linked to their doctor" },
  { icon: Activity, text: "A live dashboard of admissions, conditions and critical cases" },
];

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 font-semibold">
      <span
        className={
          inverted
            ? "flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25"
            : "flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        }
      >
        <Stethoscope className="size-5" aria-hidden />
      </span>
      <span className="text-lg">Doctor Tracker</span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-label="About Doctor Tracker"
        className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex"
      >
        {/* Soft light from the top corner; decorative only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_0%_0%,rgb(255_255_255/0.18),transparent_60%)]"
        />
        <div className="relative">
          <Brand inverted />
        </div>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Every doctor, every patient, one clear view.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-primary-foreground/90">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">
          Records are archived, never deleted, so history stays auditable.
        </p>
      </section>

      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to manage doctors and patients.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
