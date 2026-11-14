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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { numberFormat } from "@/lib/utils";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const SERIES = "var(--viz-series)";

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
  const value = payload?.[0]?.value;
  if (!active || value === undefined) return null;
  const text = label === undefined ? "" : String(label);
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="text-muted-foreground">{formatLabel ? formatLabel(text) : text}</p>
      <p className="font-medium tabular-nums">
        {numberFormat.format(Number(value))} {unit}
      </p>
    </div>
  );
}

/** Screen-reader table for each chart, so the data is never only visual. */
function DataTableFallback({
  caption,
  rows,
}: {
  caption: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM yyyy");
const monthTick = (month: string) => format(parseISO(`${month}-01`), "MMM");

export function AdmissionsChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="admissions-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
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
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback
        caption="Admissions per month"
        rows={data.map((d) => ({ label: monthLabel(d.month), value: d.count }))}
      />
    </>
  );
}

/** Horizontal bars, longest first. Optional `href` makes each bar a link. */
export function HorizontalBarChart({
  data,
  unit,
  caption,
  href,
}: {
  data: { label: string; value: number; id?: string }[];
  unit: string;
  caption: string;
  href?: (id: string) => string;
}) {
  const router = useRouter();
  const height = Math.max(160, data.length * 30 + 16);

  return (
    <>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
            <XAxis
              type="number"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={170}
              tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <ChartTooltip {...props} unit={unit} />}
            />
            <Bar
              dataKey="value"
              fill={SERIES}
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              cursor={href ? "pointer" : undefined}
              onClick={
                href
                  ? (entry: { payload?: { id?: string } }) => {
                      const id = entry.payload?.id;
                      if (id) router.push(href(id));
                    }
                  : undefined
              }
            />
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
  data: { label: string; value: number }[];
  unit: string;
  caption: string;
}) {
  return (
    <>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <ChartTooltip {...props} unit={unit} />}
            />
            <Bar
              dataKey="value"
              fill={SERIES}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTableFallback caption={caption} rows={data} />
    </>
  );
}
