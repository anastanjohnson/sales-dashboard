import { useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { repeatGuestData, repeatGuestLists } from "../data/repeatGuestData";

const number = new Intl.NumberFormat("de-DE");
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const formatDate = (value) => dateFormat.format(new Date(`${value}T12:00:00`));

const VISITOR_TYPE_COLORS = ["var(--series-1)", "var(--series-2)"];
const GAP_BUCKET_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--text-muted)"];

function PieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
          <div className="chart-tooltip">
            <div className="chart-tooltip__row">
              <span className="chart-tooltip__swatch" style={{ background: item.color || item.payload.fill }} />
              <span className="chart-tooltip__name">{item.name}</span>
              <span className="chart-tooltip__value">{item.value}%</span>
            </div>
          </div>
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

export default function RepeatedGuestPage() {
    const { yearlyRepeatCounts, visitorTypeSplit, gapBucketPercentages, visitGapStats, totalTrackedGuests, note2026 } = repeatGuestData;
    const y25 = yearlyRepeatCounts["2025"];
    const y26 = yearlyRepeatCounts["2026"];

    return (
          <div className="dashboard">
            <div className="dashboard__header">
              <div>
                <h1>Repeated Guest Analysis</h1>
                <p className="dashboard__subtitle">How often guests come back, and how long they wait between visits, across {number.format(totalTrackedGuests)} tracked guests in 2025 and 2026.</p>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__label">2025 - 3-4 visits</div><div className="stat-card__value">{number.format(y25.threeOrMore - y25.fiveOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 5-9 visits</div><div className="stat-card__value">{number.format(y25.fiveOrMore - y25.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 10+ visits</div><div className="stat-card__value">{number.format(y25.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__label">2026 - 3-4 visits</div><div className="stat-card__value">{number.format(y26.threeOrMore - y26.fiveOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 5-9 visits</div><div className="stat-card__value">{number.format(y26.fiveOrMore - y26.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 10+ visits</div><div className="stat-card__value">{number.format(y26.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
            </div>

            <GuestListPanel title="2025 - 5-9 visits" subtitle="Guests who visited 5 to 9 times in 2025 (most recent visit shown, even if in 2026)" guests={repeatGuestLists["2025"].fiveToNine} />
            <GuestListPanel title="2025 - 10+ visits" subtitle="Guests who visited 10 or more times in 2025 (most recent visit shown, even if in 2026)" guests={repeatGuestLists["2025"].tenOrMore} />
            <GuestListPanel title="2026 - 5-9 visits" subtitle="Guests who visited 5 to 9 times in 2026" guests={repeatGuestLists["2026"].fiveToNine} />
            <GuestListPanel title="2026 - 10+ visits" subtitle="Guests who visited 10 or more times in 2026" guests={repeatGuestLists["2026"].tenOrMore} />

            <div className="panel">
              <div className="panel__head"><div><h3>One-Time vs Repeat Visitors</h3><p>Share of all {number.format(visitGapStats.totalGuestsAnalyzed)} tracked guests who never returned versus those who did</p></div></div>
              <div className="sales-chart">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={visitorTypeSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}>
                      {visitorTypeSplit.map((entry, index) => (
                                <Cell key={entry.name} fill={VISITOR_TYPE_COLORS[index % VISITOR_TYPE_COLORS.length]} />
                              ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head"><div><h3>Return Visit Gap Breakdown</h3><p>Days between a guest's visit and their next one - median {visitGapStats.medianDays} days, mean {visitGapStats.meanDays} days, {number.format(visitGapStats.totalReturnVisitsAnalyzed)} return visits analyzed</p></div></div>
              <div className="sales-chart">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={gapBucketPercentages} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}>
                      {gapBucketPercentages.map((entry, index) => (
                                <Cell key={entry.name} fill={GAP_BUCKET_COLORS[index % GAP_BUCKET_COLORS.length]} />
                              ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
