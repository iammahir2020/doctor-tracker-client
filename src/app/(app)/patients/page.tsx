import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/common";
import { PatientsView } from "@/features/patients/patients-table";

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PatientsView />
    </Suspense>
  );
}
