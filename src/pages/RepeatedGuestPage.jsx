import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserX } from "lucide-react";
import { repeatGuestData, repeatGuestLists } from "../data/repeatGuestData";

const number = new Intl.NumberFormat("de-DE");
const decimal = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const formatDate = (value) => dateFormat.format(new Date(`${value}T12:00:00`));
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

function GuestListPanel({ title, subtitle, guests }) {
    const [open, setOpen] = useState(false);
    return (
          <div className="panel">
            <div className="panel__head">
              <div><h3>{title}</h3><p>{subtitle}</p></div>
              <button className="select-btn" onClick={() => setOpen((v) => !v)}>{open ? "Hide guests" : `View guests (${guests.length})`}</button>
            </div>
            {open && (
                      <div className="table-wrap">
                        <table className="salary-table">
                          <thead>
                            <tr><th>Guest</th><th>Last visit</th><th>Total visits</th></tr>
                          </thead>
                          <tbody>
                            {guests.map((guest) => (
                                      <tr key={guest.name + guest.lastVisit}>
                                        <td className="salary-table__month">{guest.name}</td>
                                        <td>{formatDate(guest.lastVisit)}</td>
                                        <td>{guest.totalVisits}</td>
                                      </tr>
                                    ))}
                          </tbody>
                        </table>
                      </div>
                    )}
          </div>
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
      yearlyRepeatCounts, visitorTypeSplitByYear, oneTimeVisitorByYear,
      gapBucketPercentagesByYear, visitGapStatsByYear, totalTrackedGuests, note2026,
    } = repeatGuestData;
    const y25 = yearlyRepeatCounts["2025"];
    const y26 = yearlyRepeatCounts["2026"];
    const oneTime25 = oneTimeVisitorByYear["2025"];
    const oneTime26 = oneTimeVisitorByYear["2026"];
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

            <div className="panel">
              <div className="panel__head"><div><h3>First-Time Visitors Who Haven't Returned</h3><p>Guests whose only tracked visit was in that year - shown separately for 2025 and 2026</p></div></div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card__head"><UserX size={16} className="stat-card__icon" /><span className="stat-card__label">2025 - One-Time Visitors</span></div>
                  <div className="stat-card__value">{decimal.format(oneTime25.pct)}%</div>
                  <div className="sales-kpi-note">{number.format(oneTime25.oneTimeGuests)} of {number.format(oneTime25.totalGuests)} guests that year</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__head"><UserX size={16} className="stat-card__icon" /><span className="stat-card__label">2026 - One-Time Visitors</span></div>
                  <div className="stat-card__value">{decimal.format(oneTime26.pct)}%</div>
                  <div className="sales-kpi-note">{number.format(oneTime26.oneTimeGuests)} of {number.format(oneTime26.totalGuests)} guests so far - {note2026.toLowerCase()}</div>
                </div>
              </div>
            </div>

            <GuestListPanel title="2025 - 5-9 visits" subtitle="Guests who visited 5 to 9 times in 2025 (most recent visit shown, even if in 2026)" guests={repeatGuestLists["2025"].fiveToNine} />
            <GuestListPanel title="2025 - 10+ visits" subtitle="Guests who visited 10 or more times in 2025 (most recent visit shown, even if in 2026)" guests={repeatGuestLists["2025"].tenOrMore} />
            <GuestListPanel title="2026 - 5-9 visits" subtitle="Guests who visited 5 to 9 times in 2026" guests={repeatGuestLists["2026"].fiveToNine} />
            <GuestListPanel title="2026 - 10+ visits" subtitle="Guests who visited 10 or more times in 2026" guests={repeatGuestLists["2026"].tenOrMore} />

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
                <div className="panel__head"><div><h3>2025 - Return Visit Gap Breakdown</h3><p>Days between a guest's visit and their next one in 2025 - median {gapStats25.medianDays} days, mean {gapStats25.meanDays} days, {number.format(gapStats25.totalReturnVisitsAnalyzed)} return visits analyzed</p></div></div>
                <div className="sales-chart">
                  <GapBucketChart data={gapBucketPercentagesByYear["2025"]} />
                </div>
              </div>
              <div className="panel panel--half">
                <div className="panel__head"><div><h3>2026 - Return Visit Gap Breakdown</h3><p>Days between a guest's visit and their next one in 2026 - median {gapStats26.medianDays} days, mean {gapStats26.meanDays} days, {number.format(gapStats26.totalReturnVisitsAnalyzed)} return visits analyzed</p></div></div>
                <div className="sales-chart">
                  <GapBucketChart data={gapBucketPercentagesByYear["2026"]} />
                </div>
              </div>
            </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
