import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { repeatGuestData } from "../data/repeatGuestData";

const number = new Intl.NumberFormat("de-DE");
const pct = (value, total) => (total ? ((value / total) * 100).toFixed(1) : "0.0");

const VISITOR_TYPE_COLORS = ["var(--series-1)", "var(--series-2)"];
const GAP_BUCKET_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--text-muted)"];

function PercentTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
          <div className="chart-tooltip">
            <div className="chart-tooltip__row">
              <span className="chart-tooltip__swatch" style={{ background: item.color || item.payload.fill }} />
              <span className="chart-tooltip__name">{item.payload.name}</span>
              <span className="chart-tooltip__value">{item.value}%</span>
            </div>
          </div>
        );
  }

function PercentBarLabel({ x, y, width, height, value }) {
    return (
          <text x={x + width + 8} y={y + height / 2} dy={4} fill="var(--text-muted)" fontSize={12}>
            {value}%
          </text>
        );
  }

function VisitorTypeChart({ data, height = 140 }) {
    return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={130} />
              <Tooltip content={<PercentTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={32} isAnimationActive={false}>
                {data.map((entry, index) => (
                          <Cell key={entry.name} fill={VISITOR_TYPE_COLORS[index % VISITOR_TYPE_COLORS.length]} />
                        ))}
                <LabelList dataKey="value" content={<PercentBarLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
  }

function GapBucketChart({ data, height = 280 }) {
    return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={130} />
              <Tooltip content={<PercentTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={32} isAnimationActive={false}>
                {data.map((entry, index) => (
                          <Cell key={entry.name} fill={GAP_BUCKET_COLORS[index % GAP_BUCKET_COLORS.length]} />
                        ))}
                <LabelList dataKey="value" content={<PercentBarLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
  }

export default function RepeatedGuestPage() {
    const {
      yearlyRepeatCounts, visitorTypeSplitByYear,
      gapBucketPercentagesByYear, visitGapStatsByYear, totalTrackedGuests,
    } = repeatGuestData;
    const y25 = yearlyRepeatCounts["2025"];
    const y26 = yearlyRepeatCounts["2026"];
    const gapStats25 = visitGapStatsByYear["2025"];
    const gapStats26 = visitGapStatsByYear["2026"];

    return (
          <div className="dashboard">
            <div className="dashboard__header">
              <div>
                <h1>Repeated Guest Analysis</h1>
                <p className="dashboard__subtitle">How often guests come back, and how long they wait between visits, across {number.format(totalTrackedGuests)} tracked guests in 2025 and 2026.</p>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__label">2025 - 3-4 visits</div><div className="stat-card__value">{number.format(y25.threeOrMore - y25.fiveOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y25.threeOrMore - y25.fiveOrMore, y25.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 5-9 visits</div><div className="stat-card__value">{number.format(y25.fiveOrMore - y25.tenOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y25.fiveOrMore - y25.tenOrMore, y25.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 10+ visits</div><div className="stat-card__value">{number.format(y25.tenOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y25.tenOrMore, y25.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__label">2026 - 3-4 visits</div><div className="stat-card__value">{number.format(y26.threeOrMore - y26.fiveOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y26.threeOrMore - y26.fiveOrMore, y26.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 5-9 visits</div><div className="stat-card__value">{number.format(y26.fiveOrMore - y26.tenOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y26.fiveOrMore - y26.tenOrMore, y26.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 10+ visits</div><div className="stat-card__value">{number.format(y26.tenOrMore)} <span className="stat-card__delta stat-card__delta--neutral">({pct(y26.tenOrMore, y26.totalGuests)}%)</span></div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
            </div>

            <div className="panel-row">
              <div className="panel panel--half">
                <div className="panel__head"><div><h3>2025 - One-Time vs Repeat Visitors</h3><p>Share of {number.format(y25.totalGuests)} guests tracked in 2025 who never returned versus those who did</p></div></div>
                <div className="sales-chart">
                  <VisitorTypeChart data={visitorTypeSplitByYear["2025"]} />
                </div>
              </div>
              <div className="panel panel--half">
                <div className="panel__head"><div><h3>2026 - One-Time vs Repeat Visitors</h3><p>Share of {number.format(y26.totalGuests)} guests tracked in 2026 so far who never returned versus those who did</p></div></div>
                <div className="sales-chart">
                  <VisitorTypeChart data={visitorTypeSplitByYear["2026"]} />
                </div>
              </div>
            </div>

            <div className="panel-row">
              <div className="panel panel--half">
                <div className="panel__head"><div><h3>2025 - Return Visit Gap Breakdown</h3><p>Days between a guest's visit and their next one in 2025.</p></div></div>
                <div className="sales-chart">
                  <GapBucketChart data={gapBucketPercentagesByYear["2025"]} />
                </div>
              </div>
              <div className="panel panel--half">
                <div className="panel__head"><div><h3>2026 - Return Visit Gap Breakdown</h3><p>Days between a guest's visit and their next one in 2026.</p></div></div>
                <div className="sales-chart">
                  <GapBucketChart data={gapBucketPercentagesByYear["2026"]} />
                </div>
              </div>
            </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
