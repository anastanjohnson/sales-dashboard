import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { repeatGuestData } from "../data/repeatGuestData";

const number = new Intl.NumberFormat("de-DE");

const tierRows = ["threeOrMore", "fiveOrMore", "tenOrMore"].map((key, index) => ({
    tier: ["3+ visits", "5+ visits", "10+ visits"][index],
    "2025": repeatGuestData.yearlyRepeatCounts["2025"][key],
    "2026": repeatGuestData.yearlyRepeatCounts["2026"][key],
  }));

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

export default function RepeatedGuestPage() {
    const { yearlyRepeatCounts, visitGapDistribution, visitGapStats, totalTrackedGuests, note2026 } = repeatGuestData;
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
              <div className="stat-card"><div className="stat-card__label">2025 - 3+ visits</div><div className="stat-card__value">{number.format(y25.threeOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 5+ visits</div><div className="stat-card__value">{number.format(y25.fiveOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
              <div className="stat-card"><div className="stat-card__label">2025 - 10+ visits</div><div className="stat-card__value">{number.format(y25.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y25.totalGuests)} guests that year</div></div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card__label">2026 - 3+ visits</div><div className="stat-card__value">{number.format(y26.threeOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 5+ visits</div><div className="stat-card__value">{number.format(y26.fiveOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
              <div className="stat-card"><div className="stat-card__label">2026 - 10+ visits</div><div className="stat-card__value">{number.format(y26.tenOrMore)}</div><div className="sales-kpi-note">of {number.format(y26.totalGuests)} guests so far</div></div>
            </div>

            <div className="panel">
              <div className="panel__head"><div><h3>Repeat Visit Tiers by Year</h3><p>Guests reaching each visit threshold, 2025 vs 2026</p></div></div>
              <div className="sales-chart">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={tierRows} margin={{ top: 16, right: 18, left: 4, bottom: 8 }} barGap={4}>
                    <CartesianGrid vertical={false} stroke="var(--grid)" />
                    <XAxis dataKey="tier" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
                    <Legend verticalAlign="top" align="right" height={34} iconType="circle" iconSize={8} />
                    <Bar dataKey="2025" name="2025" fill="var(--series-1)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="2026" name="2026" fill="var(--series-2)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="source-note">{note2026}</div>
            </div>

            <div className="panel">
              <div className="panel__head"><div><h3>Gap Between Visits</h3><p>Days between a guest's visit and their next one - median {visitGapStats.medianDays} days, mean {visitGapStats.meanDays} days, {number.format(visitGapStats.totalReturnVisitsAnalyzed)} return visits analyzed</p></div></div>
        <div className="sales-chart">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={visitGapDistribution} margin={{ top: 16, right: 18, left: 4, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="range" tickLine={false} axisLine={{ stroke: "var(--baseline)" }} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-hover)" }} />
              <Bar dataKey="count" name="Return visits" fill="var(--series-3)" radius={[5, 5, 0, 0]} maxBarSize={54} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="source-note"><strong>Source:</strong> GuestCenter reservation export, completed visits only, guests identified by phone number or email. Walk-ins without contact details cannot be tracked across visits and are excluded.</div>
    </div>
  );
}
