import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersView } from "@/features/users/users-table";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
