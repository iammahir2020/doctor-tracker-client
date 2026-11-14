import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/common";
import { DoctorsView } from "@/features/doctors/doctors-table";

export const metadata: Metadata = { title: "Doctors" };

export default function DoctorsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DoctorsView />
    </Suspense>
  );
}
