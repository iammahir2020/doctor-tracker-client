"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

const NOTICE_CLASS =
  "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400";

/**
 * Only same-origin paths, so ?next= can't be used to redirect off-site. Checking the string's
 * prefix isn't enough: browsers read "/\evil.com" and "/<tab>/evil.com" as another host.
 */
function safeNext(value: string | null) {
  if (!value) return "/";
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const server = useServerWakeStatus();

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Focus the email field on desktop only; on phones it would pop the keyboard over the page.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) setFocus("email");
  }, [setFocus]);

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => router.replace(safeNext(searchParams.get("next"))) });
  });

  const error = login.error instanceof ApiError ? login.error : null;
  // Set when an existing session was ended because the account was archived.
  const archivedNotice =
    !error && searchParams.get("reason") === "archived"
      ? "Your account has been archived. Please contact an administrator to restore access."
      : null;
  const notice = error?.code === "ACCOUNT_ARCHIVED" ? error.message : archivedNotice;

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                spellCheck={false}
                autoComplete="email"
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

            {notice ? (
              <p role="alert" className={NOTICE_CLASS}>
                {notice}
              </p>
            ) : (
              error && (
                <p
                  role="alert"
                  className={error.status === 429 ? NOTICE_CLASS : "text-sm text-destructive"}
                >
                  {error.status === 401 ? "Invalid email or password." : error.message}
                </p>
              )
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Rendered into <body> and fixed to the bottom of the screen: it appears after a few
          seconds, and as a sibling of the form it would add spacing and re-centre the page. */}
      {server !== "hidden" &&
        server !== "checking" &&
        createPortal(
          <div
            role="status"
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-lg"
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
          </div>,
          document.body,
        )}
    </>
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
