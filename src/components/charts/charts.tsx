'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

const AXIS = { stroke: '#98a1b3', fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = { stroke: '#eef0f4', vertical: false } as const;

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-ink-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-ink-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-medium tabular-nums text-ink-800">{formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export type Series = Array<{ label: string; events: number; participants: number; beneficiaries: number; cost: number }>;

export function EventsByMonthChart({ data }: { data: Series }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="eventsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cd2a63" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#cd2a63" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey="events" name="Events" stroke="#cd2a63" strokeWidth={2} fill="url(#eventsFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PeopleByMonthChart({ data }: { data: Series }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip content={<TooltipBox />} />
        <Line type="monotone" dataKey="participants" name="Participants" stroke="#1f7ae0" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="beneficiaries" name="Beneficiaries" stroke="#0d9488" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ExpenditureChart({ data }: { data: Series }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip content={<TooltipBox />} />
        <Bar dataKey="cost" name="Expenditure" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type AvenueDatum = { name: string; color: string; events: number; participants: number; beneficiaries: number; cost: number };

export function AvenueBarChart({ data }: { data: AvenueDatum[] }) {
  const rows = data.filter((d) => d.events > 0);
  if (!rows.length) return <p className="py-12 text-center text-sm text-ink-500">No events recorded yet this year.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 42)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="#eef0f4" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="name" width={140} {...AXIS} />
        <Tooltip content={<TooltipBox />} />
        <Bar dataKey="events" name="Events" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {rows.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AvenueDonut({ data }: { data: AvenueDatum[] }) {
  const rows = data.filter((d) => d.events > 0);
  if (!rows.length) return <p className="py-12 text-center text-sm text-ink-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={rows} dataKey="events" nameKey="name" innerRadius={54} outerRadius={90} paddingAngle={2}>
          {rows.map((row) => (
            <Cell key={row.name} fill={row.color} />
          ))}
        </Pie>
        <Tooltip content={<TooltipBox />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
