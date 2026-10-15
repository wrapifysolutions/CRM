"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#0f766e", "#14b8a6", "#0d9488", "#5eead4", "#134e4a", "#99f6e4"];

type Slice = { name: string; value: number; key?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: {
    value: number;
    name: string;
    color?: string;
    payload?: Slice & Record<string, unknown>;
  }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <p className="mb-1.5 font-semibold text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color ?? "#0f766e" }}
          />
          {p.name}:{" "}
          <span className="font-semibold text-foreground">
            {typeof p.value === "number" && p.value > 999
              ? p.value.toLocaleString()
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function StatusPieChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.filter((d) => d.value > 0);

  return (
    <div className="animate-fade-up h-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <span className="rounded-full bg-brand-soft/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
          {total} total
        </span>
      </div>
      {chartData.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No data yet</p>
      ) : (
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={4}
                cornerRadius={6}
                animationBegin={0}
                isAnimationActive={false}
              >
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-extrabold text-foreground">{total}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              records
            </p>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {data.map((d, i) => (
          <span
            key={d.key ?? d.name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs text-foreground"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {d.name} · {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatusBarChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {data.every((d) => d.value === 0) ? (
        <p className="py-16 text-center text-sm text-muted">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="22%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--brand-soft)", opacity: 0.35 }}
              />
              <Bar
                dataKey="value"
                name="Count"
                fill="url(#barGrad)"
                radius={[10, 10, 4, 4]}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function PipelineAreaChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {data.every((d) => d.value === 0) ? (
        <p className="py-16 text-center text-sm text-muted">No data yet</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pipelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                name="Tasks"
                stroke="#0f766e"
                strokeWidth={3}
                fill="url(#pipelineFill)"
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "#14b8a6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function MonthlyTrendChart({
  data,
  title,
}: {
  data: { name: string; clients: number; projects: number }[];
  title: string;
}) {
  const empty = data.every((d) => d.clients === 0 && d.projects === 0);
  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {empty ? (
        <p className="py-16 text-center text-sm text-muted">No trend data yet</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
              />
              <Line
                type="monotone"
                dataKey="clients"
                name="Clients"
                stroke="#0f766e"
                strokeWidth={3}
                dot={{ r: 4, fill: "#0f766e" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="projects"
                name="Projects"
                stroke="#6b93c4"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: "#6b93c4" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function BudgetMixChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {data.every((d) => d.value === 0) ? (
        <p className="py-16 text-center text-sm text-muted">No budget data yet</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barCategoryGap="28%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="value"
                name="Amount"
                radius={[0, 10, 10, 0]}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function ProgressLeadersChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No active projects yet
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barCategoryGap="16%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="value"
                name="Progress %"
                fill="#14b8a6"
                radius={[0, 8, 8, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function CompletionGauge({
  value,
  title,
  subtitle,
}: {
  value: number;
  title: string;
  subtitle: string;
}) {
  const data = [
    {
      name: title,
      value: Math.min(100, Math.max(0, value)),
      fill: "#0f766e",
    },
  ];

  return (
    <div className="animate-fade-up h-full text-center">
      <h3 className="mb-1 text-base font-bold text-foreground">{title}</h3>
      <p className="mb-2 text-xs text-muted">{subtitle}</p>
      <div className="relative mx-auto h-44 w-full max-w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="68%"
            outerRadius="100%"
            barSize={14}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: "var(--brand-soft)" }}
              dataKey="value"
              cornerRadius={10}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-extrabold text-brand">{value}%</p>
        </div>
      </div>
    </div>
  );
}

export function TeamPerformanceChart({
  data,
  title,
}: {
  data: { name: string; total: number; done: number }[];
  title: string;
}) {
  const chartData = data.slice(0, 8).map((d) => ({
    name: d.name.length > 12 ? `${d.name.slice(0, 10)}…` : d.name,
    done: d.done,
    remaining: Math.max(0, d.total - d.done),
  }));

  return (
    <div className="animate-fade-up h-full">
      <h3 className="mb-3 text-base font-bold text-foreground">{title}</h3>
      {chartData.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          Assign tasks to see team charts
        </p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="18%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="done"
                name="Done"
                stackId="a"
                fill="#0f766e"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="remaining"
                name="Open"
                stackId="a"
                fill="#94a8c0"
                radius={[8, 8, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
