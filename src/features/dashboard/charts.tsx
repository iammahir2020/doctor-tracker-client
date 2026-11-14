"use client";

// Recharts is only imported from here, and this module is loaded with next/dynamic, so the
// charting library stays out of the first-load bundle. Everything renders client-only, which is
// why reading the screen width with a media query is safe in here.
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useId } from "react";
import { cn, numberFormat, useMediaQuery } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const ACCENT = "var(--primary)";

export type BarDatum = { key: string; label: string; value: number; hint?: string };

function useWide() {
  return useMediaQuery("(min-width: 640px)", true);
}

/** SVG gradient ids must be unique per chart instance on the page. */
function useGradientId(name: string) {
  return `${name}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** One tooltip for every chart: a title plus a row per series with its colour. */
function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  unit,
}: Partial<TooltipContentProps> & {
  formatLabel?: (label: string) => string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const text = label === undefined ? "" : String(label);
  const first = payload[0]?.payload as { hint?: string; label?: string } | undefined;
  const title = formatLabel ? formatLabel(text) : (first?.label ?? text);
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="font-medium">{title}</p>
      {first?.hint && <p className="text-muted-foreground">{first.hint}</p>}
      <ul className="mt-1.5 space-y-1">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2">
            {payload.length > 1 && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: item.color ?? ACCENT }}
                aria-hidden
              />
            )}
            <span className="flex-1 text-muted-foreground">
              {payload.length > 1 ? String(item.name) : unit}
            </span>
            <span className="font-medium tabular-nums">
              {numberFormat.format(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Screen-reader table for each chart, so the data is never only visual. The sr-only class sits on
 * a wrapper div: tables ignore width/height/overflow, so a hidden table would still add page height.
 */
function DataTableFallback({
  caption,
  rows,
}: {
  caption: string;
  rows: { key: string; label: string; value: number | string }[];
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMMM yyyy");
const monthTick = (month: string) => format(parseISO(`${month}-01`), "MMM");

// Validated in this order (female, male, other); "other" is a thin dashed line with no fill so
// it never sits on top of the larger series.
export const GENDER_SERIES = [
  { key: "female", label: "Female", color: "var(--viz-female)" },
  { key: "male", label: "Male", color: "var(--viz-male)" },
  { key: "other", label: "Other", color: "var(--viz-other)" },
] as const;

/** `fill`: on large screens, grow to the card's height (cards in a row share one height). */
const FILL = "lg:h-auto lg:min-h-0 lg:flex-1";

export function AdmissionsTrend({
  data,
  fill = false,
}: {
  data: { month: string; count: number; male: number; female: number; other: number }[];
  fill?: boolean;
}) {
  const wide = useWide();
  const gid = useGradientId("admissions");
  return (
    <>
      <div className={cn("h-56 sm:h-72", fill && FILL)} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: wide ? -8 : -20, bottom: 0 }}>
            <defs>
              {GENDER_SERIES.slice(0, 2).map((s) => (
                <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={monthTick}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              minTickGap={wide ? 12 : 20}
              tickMargin={8}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={(props) => (
                <ChartTooltip {...props} unit="admissions" formatLabel={monthLabel} />
              )}
            />
            {GENDER_SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.key === "other" ? 1.5 : 2.5}
                strokeDasharray={s.key === "other" ? "4 3" : undefined}
                fill={s.key === "other" ? "none" : `url(#${gid}-${s.key})`}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback
        caption="Admissions per month by gender"
        rows={data.map((d) => ({
          key: d.month,
          label: monthLabel(d.month),
          value: `${d.female} female, ${d.male} male, ${d.other} other`,
        }))}
      />
    </>
  );
}

/** Profile of conditions as a radar, like a diagnosis "shape"; the exact numbers sit beside it. */
export function ConditionRadar({ data }: { data: BarDatum[] }) {
  const wide = useWide();
  return (
    <>
      <div className="h-56 sm:h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            outerRadius="66%"
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <PolarGrid stroke="var(--viz-grid)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: wide ? 11 : 10, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)}
            />
            <Tooltip content={(props) => <ChartTooltip {...props} unit="patients" />} />
            <Radar
              dataKey="value"
              stroke={ACCENT}
              strokeWidth={2}
              fill={ACCENT}
              fillOpacity={0.22}
              dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback caption="Patients by condition" rows={data} />
    </>
  );
}

/** Vertical bars with a soft gradient; the tallest column is highlighted. */
export function ColumnChart({
  data,
  unit,
  caption,
  fill = false,
}: {
  data: BarDatum[];
  unit: string;
  caption: string;
  fill?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value));
  const gid = useGradientId("column");
  return (
    <>
      <div className={cn("h-44 sm:h-56", fill && FILL)} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 22, right: 4, left: 4, bottom: 0 }}
            barCategoryGap="22%"
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.6} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} tickMargin={6} />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 8 }}
              content={(props) => <ChartTooltip {...props} unit={unit} />}
            />
            <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={52} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.value === max && max > 0 ? ACCENT : `url(#${gid})`} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback caption={caption} rows={data} />
    </>
  );
}
