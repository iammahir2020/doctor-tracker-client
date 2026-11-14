"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChangePassword, useCurrentUser, useRole } from "@/features/auth/api";
import { useLookupMutation, useLookups } from "@/features/lookups/api";
import { ApiError, fieldErrors, type Lookup, type LookupType } from "@/lib/api";
import { cn, useUrlState } from "@/lib/utils";

// ---------- Account: change password ----------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you haven't used here",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

function AccountTab() {
  const me = useCurrentUser();
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => reset(),
        onError: (err) => {
          const fields = fieldErrors(err);
          if (fields.currentPassword) {
            setError("currentPassword", { message: fields.currentPassword });
          }
          if (fields.newPassword) setError("newPassword", { message: fields.newPassword });
        },
      },
    );
  });

  const otherError =
    change.error instanceof ApiError && Object.keys(fieldErrors(change.error)).length === 0
      ? change.error.message
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Ask an admin to change your name or role.</CardDescription>
        </CardHeader>
        <CardContent>
          {me ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{me.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="[overflow-wrap:anywhere]">{me.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="capitalize">{me.role}</dd>
            </dl>
          ) : (
            <Skeleton className="h-16" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>8 to 72 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field
              label="Current password"
              id="current-password"
              error={errors.currentPassword?.message}
            >
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.currentPassword}
                {...register("currentPassword")}
              />
            </Field>
            <Field label="New password" id="new-password" error={errors.newPassword?.message}>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                {...register("newPassword")}
              />
            </Field>
            <Field
              label="Confirm new password"
              id="confirm-password"
              error={errors.confirmPassword?.message}
            >
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
            </Field>
            {otherError && (
              <p role="alert" className="text-sm text-destructive">
                {otherError}
              </p>
            )}
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Lookups (admin) ----------

function LookupRow({ type, item }: { type: LookupType; item: Lookup }) {
  const mutation = useLookupMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.name) {
      setEditing(false);
      setName(item.name);
      return;
    }
    mutation.mutate(
      { kind: "rename", type, id: item._id, name: trimmed },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <li className="flex min-h-11 items-center gap-2 px-3 py-1.5">
      {editing ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            aria-label={`Rename ${item.name}`}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setName(item.name);
              }
            }}
            className="h-8"
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="ghost"
            aria-label="Save name"
            disabled={mutation.isPending}
          >
            <Check aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Cancel rename"
            onClick={() => {
              setEditing(false);
              setName(item.name);
            }}
          >
            <X aria-hidden />
          </Button>
        </form>
      ) : (
        <>
          <span className={cn("flex-1 truncate", item.isArchived && "text-muted-foreground")}>
            {item.name}
          </span>
          {item.isArchived && <Badge variant="outline">Archived</Badge>}
          {!item.isArchived && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Rename ${item.name}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${item.isArchived ? "Restore" : "Archive"} ${item.name}`}
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                kind: item.isArchived ? "restore" : "archive",
                type,
                id: item._id,
              })
            }
          >
            {item.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </Button>
        </>
      )}
    </li>
  );
}

function LookupList({
  type,
  title,
  description,
  items,
}: {
  type: LookupType;
  title: string;
  description: string;
  items: Lookup[];
}) {
  const mutation = useLookupMutation();
  const [name, setName] = useState("");
  const singular = type === "specializations" ? "specialization" : "condition";
  const error =
    mutation.error instanceof ApiError
      ? mutation.error.status === 409
        ? `That ${singular} already exists`
        : mutation.error.message
      : null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            mutation.mutate(
              { kind: "create", type, name: trimmed },
              { onSuccess: () => setName("") },
            );
          }}
        >
          <Input
            aria-label={`New ${singular}`}
            placeholder={`Add a ${singular}…`}
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              mutation.reset();
            }}
          />
          <Button type="submit" variant="outline" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Plus aria-hidden />
            )}
            Add
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <ul className="divide-y rounded-md border">
          {items.map((item) => (
            <LookupRow key={item._id} type={type} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function LookupsTab() {
  const { data, isPending } = useLookups();
  if (isPending || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Renaming updates every doctor and patient that uses the entry. Archiving hides it from new
        records; existing records keep it.
      </p>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <LookupList
          type="specializations"
          title="Specializations"
          description="Used on doctors."
          items={data.raw.specializations}
        />
        <LookupList
          type="conditions"
          title="Conditions"
          description="Used on patients."
          items={data.raw.conditions}
        />
      </div>
    </div>
  );
}

// ---------- page ----------

export function SettingsView() {
  const url = useUrlState();
  const isAdmin = useRole() === "admin";
  const tab = isAdmin && url.get("tab") === "lookups" ? "lookups" : "account";

  return (
    <>
      <PageHeader title="Settings" description="Your account and the lists used across the app." />
      <Tabs value={tab} onValueChange={(t) => url.set({ tab: t === "account" ? null : t })}>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="lookups">Specializations &amp; conditions</TabsTrigger>}
        </TabsList>
        <TabsContent value="account" className="mt-4">
          <AccountTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="lookups" className="mt-4">
            <LookupsTab />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
