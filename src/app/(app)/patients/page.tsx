import type { Metadata } from "next";

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
      <p className="text-sm text-muted-foreground">Search, filter and manage patients.</p>
    </div>
  );
}
