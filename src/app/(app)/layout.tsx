import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { RoleHintProvider } from "@/features/auth/api";
import { roleFromToken } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = roleFromToken((await cookies()).get("dt_token")?.value);
  return (
    <RoleHintProvider role={role}>
      <AppShell>{children}</AppShell>
    </RoleHintProvider>
  );
}
