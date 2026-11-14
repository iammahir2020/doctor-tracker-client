"use client";

import { format, parseISO, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cake,
  CalendarRange,
  HeartPulse,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ErrorState, InitialsAvatar } from "@/components/common";
import { DateRangePicker } from "@/components/filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/api";
import { useLookups } from "@/features/lookups/api";
import { usePatients } from "@/features/patients/api";
import { STATUS_LABEL } from "@/features/patients/patient-form";
import { StatusBadge } from "@/features/patients/patients-table";
import type { PatientStatus, Stats } from "@/lib/api";
import { cn, formatDate, numberFormat, plural, toDateParam, useUrlState } from "@/lib/utils";
import { defaultRange, previousRange, useStats, useStatsRange } from "./api";

const chartFallback = () => <Skeleton className="h-60 w-full" />;
// Recharts loads on demand, after the figures above it have rendered.
const AdmissionsTrend = dynamic(() => import("./charts").then((m) => m.AdmissionsTrend), {
  ssr: false,
  loading: chartFallback,
});
const ConditionRadar = dynamic(() => import("./charts").then((m) => m.ConditionRadar), {
  ssr: false,
  loading: chartFallback,
});
const RankedBars = dynamic(() => import("./charts").then((m) => m.RankedBars), {
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
  pill,
  wordValue = false,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: keyof typeof TONES;
  className?: string;
  /** Small status pill in the corner, e.g. the change against the previous period. */
  pill?: { text: string; tone: "up" | "down" | "neutral" };
  /** A word rather than a number: a size smaller on phones so it fits without splitting. */
  wordValue?: boolean;
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
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
            {pill && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]",
                  pill.tone === "up" && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                  pill.tone === "down" && "bg-red-500/12 text-red-700 dark:text-red-300",
                  pill.tone === "neutral" && "bg-muted text-muted-foreground",
                )}
              >
                {pill.text}
              </span>
            )}
          </div>
          <p
            className={cn(
              "leading-tight font-semibold tracking-tight tabular-nums sm:text-2xl",
              wordValue ? "text-base" : "text-lg",
            )}
          >
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
  headerExtra,
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-3 py-4 sm:gap-4 sm:py-6", className)}>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{subtitle}</CardDescription>
          </div>
          {headerExtra}
        </div>
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

/** "+12%" against the previous period of the same length, or nothing when it isn't meaningful. */
function changePill(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(pct) > 500) return undefined; // the earlier period has too little data to compare
  return {
    text: `${pct >= 0 ? "+" : ""}${pct}%`,
    tone: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("neutral" as const),
  };
}

function GenderLegend({ totals }: { totals: Stats["inRange"]["byGender"] }) {
  const all = totals.reduce((sum, g) => sum + g.count, 0);
  const byKey = new Map(totals.map((g) => [g.gender, g.count]));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Series">
      {GENDER_LEGEND.map((g) => (
        <li key={g.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-4 rounded-full",
              g.key === "other" && "h-0.5 border-t-2 border-dashed bg-transparent",
            )}
            style={g.key === "other" ? { borderColor: g.color } : { background: g.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{g.label}</span>
          <span className="font-medium tabular-nums">
            {all ? Math.round(((byKey.get(g.key) ?? 0) / all) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

// Mirrors GENDER_SERIES in charts.tsx (kept here so the legend renders without loading Recharts).
const GENDER_LEGEND = [
  { key: "female", label: "Female", color: "var(--viz-female)" },
  { key: "male", label: "Male", color: "var(--viz-male)" },
  { key: "other", label: "Other", color: "var(--viz-other)" },
] as const;

/** Ranked conditions with share bars; each opens the patients list filtered to it. */
function ConditionList({
  rows,
  total,
}: {
  rows: { key: string; label: string; value: number }[];
  total: number;
}) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        return (
          <li key={r.key}>
            <Link
              href={`/patients?condition=${r.key}`}
              className="group block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium group-hover:underline">{r.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{pct}%</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {numberFormat.format(r.value)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The latest admissions, each opening the patient panel. */
function RecentAdmissions() {
  const { data, isPending } = usePatients({
    sort: "admissionDate",
    order: "desc",
    page: 1,
    pageSize: 6,
  });
  const { data: lookups } = useLookups();

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  return (
    <ul className="-mx-2 divide-y">
      {data?.data.map((p) => (
        <li key={p._id}>
          <Link
            href={`/patients?patient=${p._id}`}
            className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <InitialsAvatar name={p.name} className="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {lookups?.conditionName.get(p.condition) ?? "Unknown"}
                {p.doctorName ? ` · ${p.doctorName}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <StatusBadge status={p.status} />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {format(parseISO(p.admissionDate), "d MMM")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
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
  const rangeText = `${formatDate(range.from)} - ${formatDate(range.to)}`;

  const busiest = inRange.admissionsByMonth.reduce<{ month: string; count: number } | null>(
    (best, m) => (!best || m.count > best.count ? m : best),
    null,
  );
  const topCondition = inRange.byCondition[0];
  const criticalShare = current.activePatients
    ? Math.round((current.criticalPatients / current.activePatients) * 100)
    : 0;
  const female = inRange.byGender.find((g) => g.gender === "female")?.count ?? 0;
  const femaleShare = inRange.admissions ? Math.round((female / inRange.admissions) * 100) : 0;
  const conditionRows = inRange.byCondition.map((c) => ({
    key: c.condition,
    label: conditionName(c.condition),
    value: c.count,
  }));

  return (
    <div className="space-y-7 sm:space-y-10">
      <Section
        id="now"
        title="Right now"
        description="Live totals across all active doctors and patients."
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
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
            detail="Need attention now"
            pill={{ text: `${criticalShare}%`, tone: criticalShare > 15 ? "down" : "neutral" }}
            icon={AlertTriangle}
            tone="critical"
          />
          <StatCard
            label="Per doctor"
            value={current.avgPatientsPerDoctor.toLocaleString("en-US")}
            detail="Average caseload"
            icon={Activity}
          />
          <StatCard
            className="col-span-2 lg:col-span-1"
            label="Average age"
            value={`${current.avgPatientAge.toLocaleString("en-US")} yrs`}
            detail="Active patients"
            icon={Cake}
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
            <RankedBars
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
            <RankedBars
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Admissions"
            value={numberFormat.format(inRange.admissions)}
            pill={changePill(inRange.admissions, previous?.inRange.admissions)}
            detail={
              previous
                ? `${numberFormat.format(previous.inRange.admissions)} in the previous period`
                : "Comparing…"
            }
            icon={CalendarRange}
          />
          <StatCard
            wordValue
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
            wordValue
            label="Top condition"
            value={topCondition ? conditionName(topCondition.condition) : "None yet"}
            detail={
              topCondition && inRange.admissions
                ? `${Math.round((topCondition.count / inRange.admissions) * 100)}% of admissions`
                : undefined
            }
            icon={HeartPulse}
          />
          <StatCard
            label="Female share"
            value={`${femaleShare}%`}
            detail={`${numberFormat.format(female)} of ${numberFormat.format(inRange.admissions)} admissions`}
            icon={UsersRound}
            tone="series"
          />
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5 lg:items-start">
          <ChartCard
            title="Admissions per month"
            subtitle="Split by gender"
            className="lg:col-span-3"
            headerExtra={<GenderLegend totals={inRange.byGender} />}
          >
            <AdmissionsTrend data={inRange.admissionsByMonth} />
          </ChartCard>
          <ChartCard
            title="Recent admissions"
            subtitle="Latest patients · click to open"
            className="lg:col-span-2"
            headerExtra={
              <Button variant="link" size="sm" className="h-auto px-0" asChild>
                <Link href="/patients">View all</Link>
              </Button>
            }
          >
            <RecentAdmissions />
          </ChartCard>
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5 lg:items-start">
          <ChartCard
            title="Conditions"
            subtitle="Share of admissions in this range · click one to see its patients"
            className="lg:col-span-3"
          >
            {conditionRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admissions in this range.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <ConditionRadar data={conditionRows} />
                <ConditionList rows={conditionRows.slice(0, 6)} total={inRange.admissions} />
              </div>
            )}
          </ChartCard>
          <ChartCard
            title="Age groups"
            subtitle="Patients admitted in this range, by age today"
            className="lg:col-span-2"
          >
            <ColumnChart
              caption="Admissions by age group"
              unit="patients"
              data={inRange.byAge.map((a) => ({ key: a.label, label: a.label, value: a.count }))}
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
