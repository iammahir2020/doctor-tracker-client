import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/common";
import { UsersView } from "@/features/users/users-table";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UsersView />
    </Suspense>
  );
}
