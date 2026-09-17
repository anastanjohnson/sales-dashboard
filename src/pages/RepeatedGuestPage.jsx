import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { repeatGuestData } from "../data/repeatGuestData";
import "./RepeatedGuestPage.css";

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
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={112} />
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
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={112} />
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

function YearAnalysis({ year }) {
  const counts = repeatGuestData.yearlyRepeatCounts[year];
  const visitCounts = [
    { label: "3–4 visits", value: counts.threeOrMore - counts.fiveOrMore },
    { label: "5–9 visits", value: counts.fiveOrMore - counts.tenOrMore },
    { label: "10+ visits", value: counts.tenOrMore },
  ];

  return (
    <section className={`repeat-year repeat-year--${year}`} aria-labelledby={`repeat-year-${year}`}>
      <header className="repeat-year__header">
        <h2 id={`repeat-year-${year}`}><span>{year}</span> Analysis</h2>
        <p>{number.format(counts.totalGuests)} tracked guests</p>
        <p className="repeat-year__period">{year === "2026" ? repeatGuestData.note2026 : "2025 reporting year"}</p>
      </header>

      <div className="repeat-year__stats">
        {visitCounts.map(({ label, value }) => (
          <div className="stat-card" key={label}>
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value">{number.format(value)}</div>
            <div className="sales-kpi-note">{pct(value, counts.totalGuests)}% of {year} guests</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>{year} · One-Time vs Repeat Visitors</h3>
          <p>Share of tracked guests in {year} who visited once versus those who returned.</p>
        </div>
        <div className="sales-chart">
          <VisitorTypeChart data={repeatGuestData.visitorTypeSplitByYear[year]} />
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>{year} · Return Visit Gap Breakdown</h3>
          <p>Days between a guest’s visit and their next one in {year}.</p>
        </div>
        <div className="sales-chart">
          <GapBucketChart data={repeatGuestData.gapBucketPercentagesByYear[year]} />
        </div>
      </div>
    </section>
  );
}

export default function RepeatedGuestPage() {
  return (
    <div className="dashboard repeated-guest-page">
      <div className="dashboard__header">
        <div>
          <h1>Repeated Guest Analysis</h1>
          <p className="dashboard__subtitle">How often guests come back, and how long they wait between visits, across {number.format(repeatGuestData.totalTrackedGuests)} tracked guests in 2025 and 2026.</p>
        </div>
      </div>

      <div className="repeat-year-comparison">
        <YearAnalysis year="2025" />
        <YearAnalysis year="2026" />
      </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
