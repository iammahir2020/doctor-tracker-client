"use client";

import { startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { Activity, AlertTriangle, CalendarRange, Stethoscope, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import { ErrorState, PageHeader } from "@/components/common";
import { DateRangePicker } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/features/lookups/api";
import { STATUS_LABEL } from "@/features/patients/patient-form";
import type { PatientStatus, Stats } from "@/lib/api";
import { cn, formatDate, numberFormat, toDateParam, useUrlState } from "@/lib/utils";
import { defaultRange, useStats, useStatsRange } from "./api";

const chartFallback = () => <Skeleton className="h-56 w-full" />;
// Recharts loads on demand, after the KPI row has rendered.
const AdmissionsChart = dynamic(() => import("./charts").then((m) => m.AdmissionsChart), {
  ssr: false,
  loading: chartFallback,
});
const HorizontalBarChart = dynamic(() => import("./charts").then((m) => m.HorizontalBarChart), {
  ssr: false,
  loading: chartFallback,
});
const ColumnChart = dynamic(() => import("./charts").then((m) => m.ColumnChart), {
  ssr: false,
  loading: chartFallback,
});

const PRESETS = [
  { label: "30 days", from: () => subDays(new Date(), 29) },
  { label: "90 days", from: () => subDays(new Date(), 89) },
  { label: "12 months", from: () => startOfMonth(subMonths(new Date(), 11)) },
  { label: "This year", from: () => startOfYear(new Date()) },
];

function RangeControls({ range }: { range: { from: string; to: string } }) {
  const url = useUrlState();
  const today = toDateParam(new Date());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => {
          const from = toDateParam(p.from());
          const active = range.from === from && range.to === today;
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "secondary" : "ghost"}
              aria-pressed={active}
              className="h-7"
              onClick={() =>
                // The 12-month default keeps a clean URL.
                from === defaultRange().from
                  ? url.clear(["from", "to"])
                  : url.set({ from, to: today })
              }
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      <DateRangePicker
        label="Custom range"
        clearable={false}
        value={range}
        onChange={(r) => r.from && url.set({ from: r.from, to: r.to ?? r.from })}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "critical";
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon
            className={cn(
              "size-4 text-muted-foreground",
              tone === "critical" && "text-[var(--viz-critical)]",
            )}
          />
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Validated for colour-blind separation in exactly this order: recovered, active, critical.
const STATUS_ORDER: PatientStatus[] = ["recovered", "active", "critical"];
const STATUS_COLOR: Record<PatientStatus, string> = {
  recovered: "var(--viz-good)",
  active: "var(--viz-series)",
  critical: "var(--viz-critical)",
};

function StatusBreakdown({ data }: { data: { status: PatientStatus; count: number }[] }) {
  const counts = new Map(data.map((d) => [d.status, d.count]));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No admissions.</p>;

  return (
    <div className="space-y-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {STATUS_ORDER.map((s) => {
          const count = counts.get(s) ?? 0;
          return count > 0 ? (
            <div
              key={s}
              style={{ width: `${(count / total) * 100}%`, background: STATUS_COLOR[s] }}
              title={`${STATUS_LABEL[s]}: ${count}`}
            />
          ) : null;
        })}
      </div>
      <ul className="space-y-2 text-sm">
        {STATUS_ORDER.map((s) => {
          const count = counts.get(s) ?? 0;
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[s] }}
                aria-hidden
              />
              <span className="flex-1">{STATUS_LABEL[s]}</span>
              <span className="font-medium tabular-nums">{numberFormat.format(count)}</span>
              <span className="w-12 text-right text-muted-foreground tabular-nums">
                {Math.round((count / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function DashboardBody({ stats, range }: { stats: Stats; range: { from: string; to: string } }) {
  const { data: lookups } = useLookups();
  const { current, inRange } = stats;
  // The selected dates, not the server's UTC end-of-day timestamp (which can read as the next day).
  const rangeText = `${formatDate(range.from)} – ${formatDate(range.to)}`;
  const specializationName = (id: string) => lookups?.specializationName.get(id) ?? "Unknown";
  const conditionName = (id: string) => lookups?.conditionName.get(id) ?? "Unknown";

  return (
    <div className="space-y-4">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Doctors"
          value={numberFormat.format(current.totalDoctors)}
          hint="Current"
          icon={Stethoscope}
        />
        <StatCard
          label="Active patients"
          value={numberFormat.format(current.activePatients)}
          hint="Current, not archived"
          icon={UsersRound}
        />
        <StatCard
          label="Critical now"
          value={numberFormat.format(current.criticalPatients)}
          hint="Current"
          icon={AlertTriangle}
          tone="critical"
        />
        <StatCard
          label="Patients per doctor"
          value={current.avgPatientsPerDoctor.toLocaleString("en-US")}
          hint="Current average"
          icon={Activity}
        />
        <StatCard
          label="Admissions"
          value={numberFormat.format(inRange.admissions)}
          hint="In selected range"
          icon={CalendarRange}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Admissions per month" subtitle={rangeText} className="lg:col-span-2">
          <AdmissionsChart data={inRange.admissionsByMonth} />
        </ChartCard>
        <ChartCard title="Patients by status" subtitle={`Admitted ${rangeText}`}>
          <StatusBreakdown data={inRange.byStatus} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 doctors" subtitle="Current active patients · click a bar to open">
          <HorizontalBarChart
            caption="Top 10 doctors by active patients"
            unit="patients"
            href={(id) => `/doctors/${id}`}
            data={current.topDoctors.map((d) => ({
              id: d._id,
              label: d.name,
              value: d.patientCount,
            }))}
          />
        </ChartCard>
        <ChartCard title="Patients per doctor" subtitle="Current · number of doctors in each range">
          <ColumnChart
            caption="Doctors by number of active patients"
            unit="doctors"
            data={current.patientsPerDoctor.map((b) => ({ label: b.label, value: b.count }))}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Patients by condition" subtitle={`Admitted ${rangeText}`}>
          <HorizontalBarChart
            caption="Patients by condition"
            unit="patients"
            data={inRange.byCondition.map((c) => ({
              label: conditionName(c.condition),
              value: c.count,
            }))}
          />
        </ChartCard>
        <ChartCard title="Doctors by specialization" subtitle="Current">
          <HorizontalBarChart
            caption="Doctors by specialization"
            unit="doctors"
            data={current.doctorsBySpecialization.map((s) => ({
              label: specializationName(s.specialization),
              value: s.count,
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}

export function Dashboard() {
  const range = useStatsRange();
  const { data, error, isPending, isFetching, refetch } = useStats(range);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Current totals, plus admissions for the selected range."
        actions={<RangeControls range={range} />}
      />
      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("transition-opacity", isFetching && "opacity-70")}>
          <DashboardBody stats={data} range={range} />
        </div>
      )}
    </>
  );
}
