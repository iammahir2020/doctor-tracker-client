"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useLogin } from "./api";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

/** Only same-site relative paths, so ?next= can't be used to redirect off-site. */
function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const server = useServerWakeStatus();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => router.replace(safeNext(searchParams.get("next"))) });
  });

  const error = login.error instanceof ApiError ? login.error : null;

  return (
    <Card>
      <CardContent className="space-y-4">
        {server !== "hidden" && server !== "checking" && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-sm transition-opacity"
          >
            {server === "waking" ? (
              <>
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
                <span>Waking up the server (free hosting). This can take up to a minute…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Server ready.</span>
              </>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className={
                error.status === 429
                  ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                  : "text-sm text-destructive"
              }
            >
              {error.status === 401 ? "Invalid email or password." : error.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type WakeStatus = "checking" | "waking" | "ready" | "hidden";

/**
 * Pings /api/health on mount. If it hasn't answered within 3s the server is probably cold-starting,
 * so a banner explains the wait instead of letting the sign-in look broken.
 */
function useServerWakeStatus(): WakeStatus {
  const [status, setStatus] = useState<WakeStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();
    let slow = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const slowTimer = setTimeout(() => {
      slow = true;
      setStatus("waking");
    }, 3_000);

    fetch("/api/health", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)]),
    })
      .catch(() => undefined)
      .finally(() => {
        if (controller.signal.aborted) return;
        clearTimeout(slowTimer);
        if (!slow) return setStatus("hidden");
        setStatus("ready");
        hideTimer = setTimeout(() => setStatus("hidden"), 2_500);
      });

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return status;
}
