"use client";

import { format, parseISO, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  HeartPulse,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorState } from "@/components/common";
import { DateRangePicker } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/api";
import { useLookups } from "@/features/lookups/api";
import { STATUS_LABEL } from "@/features/patients/patient-form";
import type { PatientStatus, Stats } from "@/lib/api";
import { cn, formatDate, numberFormat, plural, toDateParam, useUrlState } from "@/lib/utils";
import { defaultRange, previousRange, useStats, useStatsRange } from "./api";

const chartFallback = () => <Skeleton className="h-60 w-full" />;
// Recharts loads on demand, after the figures above it have rendered.
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

type Range = { from: string; to: string };

const PRESETS = [
  { label: "30 days", from: () => subDays(new Date(), 29) },
  { label: "90 days", from: () => subDays(new Date(), 89) },
  { label: "12 months", from: () => startOfMonth(subMonths(new Date(), 11)) },
  { label: "This year", from: () => startOfYear(new Date()) },
];

// ---------- small building blocks ----------

function RangeControls({ range }: { range: Range }) {
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

const TONES = {
  series: "var(--viz-series)",
  good: "var(--viz-good)",
  critical: "var(--viz-critical)",
} as const;

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "series",
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const color = TONES[tone];
  return (
    <Card className={cn("gap-0 py-3 sm:py-4", className)}>
      <CardContent className="flex items-start gap-2.5 px-3 sm:gap-3 sm:px-4">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md sm:size-9 sm:rounded-lg"
          style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}
          aria-hidden
        >
          <Icon className="size-4 sm:size-4.5" style={{ color }} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
          <p className="text-lg leading-tight font-semibold tracking-tight break-words tabular-nums sm:text-2xl">
            {value}
          </p>
          {detail && (
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {detail}
            </div>
          )}
        </div>
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
    <Card className={cn("gap-3 py-4 sm:gap-4 sm:py-6", className)}>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">{children}</CardContent>
    </Card>
  );
}

function Section({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 border-b pb-2 sm:pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id={id} className="text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Change vs the previous period, e.g. "▲ 12% vs previous 30 days". */
function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return <span>Comparing…</span>;
  if (previous === 0) return <span>No admissions in the previous period</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  // A huge jump usually means the earlier period has little data; a raw count is more honest.
  if (Math.abs(pct) > 500) {
    return <span>{numberFormat.format(previous)} in the previous period</span>;
  }
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon className="size-3.5" aria-hidden />
      <span className="font-medium text-foreground">{Math.abs(pct)}%</span>
      {pct >= 0 ? " more" : " fewer"} than the previous period
    </span>
  );
}

// Validated for colour-blind separation in exactly this order: recovered, active, critical.
const STATUS_ORDER: PatientStatus[] = ["recovered", "active", "critical"];
const STATUS_COLOR: Record<PatientStatus, string> = {
  recovered: TONES.good,
  active: TONES.series,
  critical: TONES.critical,
};

function StatusBreakdown({ data }: { data: { status: PatientStatus; count: number }[] }) {
  const counts = new Map(data.map((d) => [d.status, d.count]));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No patients.</p>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full sm:h-4" aria-hidden>
        {STATUS_ORDER.map((s) => {
          const count = counts.get(s) ?? 0;
          return count > 0 ? (
            <div
              key={s}
              style={{ width: `${(count / total) * 100}%`, background: STATUS_COLOR[s] }}
            />
          ) : null;
        })}
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {STATUS_ORDER.map((s) => {
          const count = counts.get(s) ?? 0;
          return (
            <li key={s} className="space-y-0.5 rounded-lg border p-2 sm:space-y-1 sm:p-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLOR[s] }}
                  aria-hidden
                />
                {STATUS_LABEL[s]}
              </span>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">
                {numberFormat.format(count)}
              </p>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                {Math.round((count / total) * 100)}%
                <span className="hidden sm:inline"> of patients</span>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- page ----------

/** Name and local time of day are only known in the browser, after hydration. */
function Greeting() {
  const me = useCurrentUser();
  // Fixed one-line height: the text is filled in after load, so it must not change the layout.
  let text = "";
  if (me) {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    text = `${part}, ${me.name.split(" ")[0]}`;
  }
  return <p className="h-5 truncate text-sm font-medium text-primary">{text}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function DashboardBody({
  stats,
  previous,
  range,
}: {
  stats: Stats;
  previous: Stats | undefined;
  range: Range;
}) {
  const { data: lookups } = useLookups();
  const { current, inRange } = stats;
  const specializationName = (id: string) => lookups?.specializationName.get(id) ?? "Unknown";
  const conditionName = (id: string) => lookups?.conditionName.get(id) ?? "Unknown";
  // The selected dates, not the server's UTC end-of-day timestamp (which can read as the next day).
  const rangeText = `${formatDate(range.from)} – ${formatDate(range.to)}`;

  const busiest = inRange.admissionsByMonth.reduce<{ month: string; count: number } | null>(
    (best, m) => (!best || m.count > best.count ? m : best),
    null,
  );
  const topCondition = inRange.byCondition[0];
  const criticalShare = current.activePatients
    ? Math.round((current.criticalPatients / current.activePatients) * 100)
    : 0;

  return (
    <div className="space-y-7 sm:space-y-10">
      <Section
        id="now"
        title="Right now"
        description="Live totals across all active doctors and patients."
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Doctors"
            value={numberFormat.format(current.totalDoctors)}
            detail={`Across ${plural(current.doctorsBySpecialization.length, "specialization")}`}
            icon={Stethoscope}
          />
          <StatCard
            label="Active patients"
            value={numberFormat.format(current.activePatients)}
            detail="Not archived"
            icon={UsersRound}
          />
          <StatCard
            label="Critical"
            value={numberFormat.format(current.criticalPatients)}
            detail={`${criticalShare}% of active patients`}
            icon={AlertTriangle}
            tone="critical"
          />
          <StatCard
            label="Patients per doctor"
            value={current.avgPatientsPerDoctor.toLocaleString("en-US")}
            detail="Average caseload"
            icon={Activity}
          />
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5 lg:items-start">
          <ChartCard
            title="Patient status"
            subtitle="All active patients"
            className="lg:col-span-2"
          >
            <StatusBreakdown data={current.patientsByStatus} />
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/patients?status=critical">
                  View critical patients <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/patients">All patients</Link>
              </Button>
            </div>
          </ChartCard>
          <ChartCard
            title="Busiest doctors"
            subtitle="Top 10 by active patients · click a bar to open"
            className="lg:col-span-3"
          >
            <HorizontalBarChart
              caption="Top 10 doctors by active patients"
              unit="patients"
              href={(id) => `/doctors/${id}`}
              data={current.topDoctors.map((d) => ({
                key: d._id,
                label: d.name,
                value: d.patientCount,
                hint: specializationName(d.specialization),
              }))}
            />
          </ChartCard>
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
          <ChartCard title="Caseload spread" subtitle="Doctors by number of active patients">
            <ColumnChart
              caption="Doctors by number of active patients"
              unit="doctors"
              data={current.patientsPerDoctor.map((b) => ({
                key: b.label,
                label: b.label,
                value: b.count,
              }))}
            />
          </ChartCard>
          <ChartCard title="Doctors by specialization" subtitle="Active doctors">
            <HorizontalBarChart
              caption="Doctors by specialization"
              unit="doctors"
              data={current.doctorsBySpecialization.map((s) => ({
                key: s.specialization,
                label: specializationName(s.specialization),
                value: s.count,
              }))}
            />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="admissions"
        title="Admissions"
        description={`Patients admitted ${rangeText}. The date range only affects this section.`}
        actions={<RangeControls range={range} />}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard
            label="Admissions"
            value={numberFormat.format(inRange.admissions)}
            detail={<Delta current={inRange.admissions} previous={previous?.inRange.admissions} />}
            icon={CalendarRange}
          />
          <StatCard
            label="Busiest month"
            value={
              busiest && busiest.count > 0
                ? format(parseISO(`${busiest.month}-01`), "MMM yyyy")
                : "None yet"
            }
            detail={busiest ? plural(busiest.count, "admission") : undefined}
            icon={TrendingUp}
          />
          <StatCard
            className="col-span-2 sm:col-span-1"
            label="Most common condition"
            value={topCondition ? conditionName(topCondition.condition) : "None yet"}
            detail={
              topCondition && inRange.admissions
                ? `${Math.round((topCondition.count / inRange.admissions) * 100)}% of admissions`
                : undefined
            }
            icon={HeartPulse}
          />
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
          <ChartCard
            title="Admissions per month"
            subtitle="Dashed line is the monthly average"
            className="lg:col-span-3"
          >
            <AdmissionsChart data={inRange.admissionsByMonth} />
          </ChartCard>
          <ChartCard
            title="By condition"
            subtitle="Patients admitted in this range"
            className="lg:col-span-2"
          >
            <HorizontalBarChart
              caption="Admissions by condition"
              unit="patients"
              data={inRange.byCondition.map((c) => ({
                key: c.condition,
                label: conditionName(c.condition),
                value: c.count,
              }))}
            />
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}

export function Dashboard() {
  const range = useStatsRange();
  const stats = useStats(range);
  const previous = useStats(previousRange(range));
  const lookups = useLookups();

  // Lookup names are needed for every chart label, so wait for both.
  const ready = stats.data && lookups.data;
  const failed = (stats.error && !stats.data) || (lookups.error && !lookups.data);

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3 sm:mb-8">
        <div className="space-y-1">
          <Greeting />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Here&apos;s how the practice looks today.
          </p>
        </div>
        {/* Right-aligned row, reversed so the button sits at the fixed right edge: the "Updated"
            text appearing after load grows to its left and never moves it. */}
        <div className="flex flex-row-reverse items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Refresh now"
            disabled={stats.isFetching}
            onClick={() => void stats.refetch()}
          >
            <RefreshCw className={cn(stats.isFetching && "animate-spin")} aria-hidden />
          </Button>
          {stats.dataUpdatedAt > 0 && (
            <span aria-live="polite">
              Updated {format(stats.dataUpdatedAt, "HH:mm")}
              <span className="hidden sm:inline"> · refreshes every minute</span>
            </span>
          )}
        </div>
      </div>

      {failed ? (
        <ErrorState
          error={stats.error ?? lookups.error}
          onRetry={() => {
            void stats.refetch();
            void lookups.refetch();
          }}
        />
      ) : !ready ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("transition-opacity", stats.isPlaceholderData && "opacity-70")}>
          <DashboardBody
            stats={stats.data}
            previous={previous.isPlaceholderData ? undefined : previous.data}
            range={range}
          />
        </div>
      )}
    </>
  );
}
