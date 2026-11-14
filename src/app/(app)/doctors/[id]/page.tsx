import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/common";
import { DoctorDetail } from "@/features/doctors/doctor-detail";

const apiUrl = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export async function generateMetadata({ params }: PageProps<"/doctors/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    // Short timeout: a sleeping free-tier API must not hold up the page; the title just falls back.
    const res = await fetch(`${apiUrl}/api/doctors/${encodeURIComponent(id)}`, {
      headers: { cookie: (await cookies()).toString() },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const doctor = (await res.json()) as { name?: unknown };
      if (typeof doctor.name === "string") return { title: doctor.name };
    }
  } catch {
    // Fall through to the generic title.
  }
  return { title: "Doctor" };
}

export default async function DoctorPage({ params }: PageProps<"/doctors/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DoctorDetail id={id} />
    </Suspense>
  );
}
