import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "@/lib/prices";
import { formatUsdFull } from "@/lib/format";

export function PriceChart({ data, positive }: { data: ChartPoint[]; positive: boolean }) {
  const stroke = positive ? "var(--color-success)" : "var(--color-danger)";
  const rows = data.map((d) => ({ t: d.t, p: d.p }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis dataKey="p" hide domain={["auto", "auto"]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as { t: number; p: number };
              return (
                <div className="rounded-md bg-card-elevated px-3 py-2 text-xs shadow-border">
                  <div className="tabular font-medium">{formatUsdFull(row.p)}</div>
                  <div className="mt-0.5 text-muted">{new Date(row.t).toLocaleString()}</div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="p" stroke={stroke} strokeWidth={2} fill="url(#px)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
