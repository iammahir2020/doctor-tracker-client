import type { Metadata } from "next";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="text-sm text-muted-foreground">Manage who can sign in.</p>
    </div>
  );
}
