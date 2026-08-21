import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { repeatGuestData, repeatGuestLists } from "../data/repeatGuestData";

const number = new Intl.NumberFormat("de-DE");
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const formatDate = (value) => dateFormat.format(new Date(`${value}T12:00:00`));

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
          <div className="chart-tooltip">
            <div className="chart-tooltip__label">{label}</div>
            {payload.map((item) => (
                      <div className="chart-tooltip__row" key={item.name}>
                        <span className="chart-tooltip__swatch" style={{ background: item.color || item.fill }} />
                        <span className="chart-tooltip__name">{item.name}</span>
                        <span className="chart-tooltip__value">{number.format(item.value)}</span>
                      </div>
                    ))}
          </div>
        );
  }

function PercentTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
          <div className="chart-tooltip">
            <div className="chart-tooltip__label">{label}</div>
            {payload.map((item) => (
                      <div className="chart-tooltip__row" key={item.name}>
                        <span className="chart-tooltip__swatch" style={{ background: item.color || item.fill }} />
                        <span className="chart-tooltip__name">{item.name}</span>
                        <span className="chart-tooltip__value">{item.value}%</span>
                      </div>
                    ))}
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
    const { yearlyRepeatCounts, visitGapPercentages, visitGapStats, totalTrackedGuests, note2026 } = repeatGuestData;
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
              <div className="panel__head"><div><h3>Gap Between Visits</h3><p>Share of return visits within each gap window (median {visitGapStats.medianDays} days, mean {visitGapStats.meanDays} days, {number.format(visitGapStats.totalReturnVisitsAnalyzed)} return visits analyzed); one-time visitors as a share of all {number.format(visitGapStats.totalGuestsAnalyzed)} tracked guests</p></div></div>
        <div className="sales-chart">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={visitGapPercentages} margin={{ top: 16, right: 18, left: 4, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="range" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} allowDecimals={false} unit="%" />
              <Tooltip content={<PercentTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
              <Bar dataKey="pct" name="Share" fill="var(--series-3)" radius={[5, 5, 0, 0]} maxBarSize={54} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
