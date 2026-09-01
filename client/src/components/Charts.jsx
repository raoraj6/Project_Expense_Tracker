import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';

// Categorical palette — distinguishable in light and dark, ordered for contrast.
const PALETTE = [
  '#4f7cff', '#ef7c4d', '#2fb8a2', '#c76bd6', '#e0b13a',
  '#5aa9e6', '#e2687f', '#7dbb54', '#8b7ff0', '#d1793f',
  '#3fa8c4', '#9aa0ae',
];

const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

export function CategoryPie({ data }) {
  if (!data?.length) return <Empty label="No spending in this period" />;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={2}
          // Entry animation can stall under rAF throttling, leaving zero-sweep
          // arcs. A dashboard must be correct on first paint, so skip it.
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmt(v)} />
        <Legend verticalAlign="bottom" height={72} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data }) {
  if (!data?.length) return <Empty label="No trend data yet" />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => fmt(v)} />
        <Legend iconType="circle" />
        <Line type="monotone" dataKey="income" stroke={PALETTE[2]} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="expense" stroke={PALETTE[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }) {
  if (!data?.length) return <Empty label="No spending in this period" />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="category" width={124} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => fmt(v)} />
        <Bar dataKey="total" fill={PALETTE[0]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }) {
  return <div className="chart-empty muted">{label}</div>;
}
