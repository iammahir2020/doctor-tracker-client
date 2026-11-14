"use client";

// Recharts is only imported from here, and this module is loaded with next/dynamic, so the
// charting library stays out of the first-load bundle.
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { numberFormat } from "@/lib/utils";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const SERIES = "var(--viz-series)";

export type BarDatum = { key: string; label: string; value: number; hint?: string };

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
  const first = payload?.[0];
  if (!active || first?.value === undefined) return null;
  const text = label === undefined ? "" : String(label);
  const hint = (first.payload as { hint?: string } | undefined)?.hint;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{formatLabel ? formatLabel(text) : text}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <p className="mt-1 tabular-nums">
        {numberFormat.format(Number(first.value))} {unit}
      </p>
    </div>
  );
}

/**
 * Screen-reader table for each chart, so the data is never only visual. The sr-only class sits on
 * a wrapper div: tables ignore width/height/overflow, so a hidden table would still add page height.
 */
function DataTableFallback({ caption, rows }: { caption: string; rows: BarDatum[] }) {
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

export function AdmissionsChart({ data }: { data: { month: string; count: number }[] }) {
  const average = data.length ? data.reduce((sum, d) => sum + d.count, 0) / data.length : 0;
  return (
    <>
      <div className="h-72" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="admissions-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="month"
              tickFormatter={monthTick}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            {data.length > 1 && (
              <ReferenceLine
                y={average}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: `avg ${Math.round(average)}`,
                  position: "insideTopLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            )}
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={(props) => (
                <ChartTooltip {...props} unit="admissions" formatLabel={monthLabel} />
              )}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={SERIES}
              strokeWidth={2}
              fill="url(#admissions-fill)"
              dot={data.length <= 3 ? { r: 4, fill: SERIES, strokeWidth: 0 } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback
        caption="Admissions per month"
        rows={data.map((d) => ({ key: d.month, label: monthLabel(d.month), value: d.count }))}
      />
    </>
  );
}

/** Horizontal bars, longest first, each labelled with its value. Optional `href` makes bars links. */
export function HorizontalBarChart({
  data,
  unit,
  caption,
  href,
}: {
  data: BarDatum[];
  unit: string;
  caption: string;
  href?: (key: string) => string;
}) {
  const router = useRouter();
  const height = Math.max(160, data.length * 32 + 16);

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={175}
              interval={0}
              tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <ChartTooltip {...props} unit={unit} />}
            />
            <Bar
              dataKey="value"
              fill={SERIES}
              radius={4}
              maxBarSize={22}
              isAnimationActive={false}
              cursor={href ? "pointer" : undefined}
              onClick={
                href
                  ? (entry: { payload?: BarDatum }) => {
                      if (entry.payload) router.push(href(entry.payload.key));
                    }
                  : undefined
              }
            >
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 12, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback caption={caption} rows={data} />
    </>
  );
}

export function ColumnChart({
  data,
  unit,
  caption,
}: {
  data: BarDatum[];
  unit: string;
  caption: string;
}) {
  return (
    <>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <ChartTooltip {...props} unit={unit} />}
            />
            <Bar
              dataKey="value"
              fill={SERIES}
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position="top"
                style={{ fontSize: 12, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback caption={caption} rows={data} />
    </>
  );
}
