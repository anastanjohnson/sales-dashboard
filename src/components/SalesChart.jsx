import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="chart-tooltip">
              <div className="chart-tooltip__label">{label}</div>
          {payload.map((entry)  => (
                  <div className="chart-tooltip__row" key={entry.dataKey}>
                            <span className="chart-tooltip__swatch" style={{ background: entry.color }} />
                            <span className="chart-tooltip__name">{entry.name}</span>
                            <span className="chart-tooltip__value">
                              {entry.dataKey === "sales" ? `$${entry.value.toLocaleString()}` : entry.value}
                            </span>
                  </div>
                ))}
        </div>
        );
}

export default function SalesChart({ data }) {
    return (
      <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--grid)" />
                        <XAxis
                                    dataKey="day"
                                    tickLine={false}
                                    axisLine={{ stroke: "var(--baseline)" }}
                                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                                  />
                        <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                                    width={48}
                                  />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
                        <Legend
                                    verticalAlign="top"
                                    align="right"
                                    height={32}
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ color: "var(--text-secondary)", fontSize: 12 }}
                                  />
                        <Bar
                                    dataKey="sales"
                                    name="Sales ($)"
                                    fill="var(--series-1)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                  />
                        <Bar
                                    dataKey="orders"
                                    name="Orders"
                                    fill="var(--series-2)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                  />
              </BarChart>
      </ResponsiveContainer>
        );
}
