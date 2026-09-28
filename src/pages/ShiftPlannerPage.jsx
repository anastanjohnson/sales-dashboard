import { useState } from "react";
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Columns3, Rows3 } from "lucide-react";
import "./ShiftPlannerPage.css";

// Visual sample from the approved reference. This screen does not publish staff schedules.
const SAMPLE_MONDAY = "2026-09-28";
const OPEN_DAYS = [0, 3, 4, 5, 6];
const SAMPLE_SHIFTS = {
  0: [["12:00", "17:00", "Maria"], ["16:00", "22:00", "Alex"], ["17:00", "22:00", "Sam"], ["17:00", "22:00", "Maria"]],
  3: [["16:00", "22:00", "Sam"], ["17:00", "22:00", "Alex"]],
  4: [["16:00", "22:00", "Sam"], ["17:00", "22:00", "Alex"], ["17:00", "22:00", "Maria"]],
  5: [["11:00", "17:00", "Alex"], ["12:00", "17:00", "Maria"], ["17:00", "22:00", "Sam"], ["17:00", "22:00", "Alex"], ["17:00", "22:00", "Maria"]],
  6: [["11:00", "17:00", "Sam"], ["12:00", "17:00", "Alex"], ["17:00", "22:00", "Sam"], ["17:00", "22:00", "Alex"], ["17:00", "22:00", "Maria"]],
};
const format = (date, options) => date.toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
const dateAt = (offset) => {
  const date = new Date(`${SAMPLE_MONDAY}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

export default function ShiftPlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState("week");
  const [selectedDay, setSelectedDay] = useState(0);
  const [openOnly, setOpenOnly] = useState(false);
  const start = dateAt(weekOffset * 7);
  const end = dateAt(weekOffset * 7 + 6);
  const days = OPEN_DAYS.map((offset) => ({
    offset,
    date: dateAt(weekOffset * 7 + offset),
    shifts: weekOffset === 0 ? SAMPLE_SHIFTS[offset] : [],
  }));
  const shifts = days.flatMap((day) => day.shifts);
  const assigned = shifts.filter((shift) => shift[2]).length;
  const visibleDays = view === "day" ? days.filter((day) => day.offset === selectedDay) : days;
  const range = `${format(start, { day: "numeric", month: "short" })} – ${format(end, { day: "numeric", month: "short" })}`;
  const year = start.getUTCFullYear() === end.getUTCFullYear() ? start.getUTCFullYear() : `${start.getUTCFullYear()} / ${end.getUTCFullYear()}`;

  return (
    <section className="shift-planner" aria-label="Shift Planner">
      <header className="dashboard__header">
        <div>
          <h1>Shift Planner</h1>
          <p className="dashboard__subtitle">Your team’s week, at a glance.</p>
        </div>
        <span className="shift-planner__preview">Screen preview</span>
      </header>

      <div className="shift-planner__toolbar">
        <button type="button" className="btn btn--ghost" onClick={() => setWeekOffset((week) => week - 1)}>
          <ChevronLeft size={16} aria-hidden="true" /><span>Previous week</span>
        </button>
        <div className="shift-planner__range" aria-live="polite" aria-atomic="true">
          <h2>{range}</h2>
          <p>{year} · Monday to Sunday</p>
        </div>
        <div className="shift-planner__toolbar-end">
          <button type="button" className="btn btn--ghost" onClick={() => setWeekOffset((week) => week + 1)}>
            <span>Next week</span><ChevronRight size={16} aria-hidden="true" />
          </button>
          <div className="shift-planner__view" role="group" aria-label="Planner view">
            <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>
              {view === "week" ? <Check size={16} aria-hidden="true" /> : <Columns3 size={16} aria-hidden="true" />}Week view
            </button>
            <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>
              <Rows3 size={16} aria-hidden="true" />Day view
            </button>
          </div>
        </div>
      </div>

      <div className="shift-planner__summary">
        <div>
          <h2>Weekly planner</h2>
          <p>Sample schedule · Preview only</p>
        </div>
        <div className="shift-planner__actions">
          <div className="shift-planner__counts" aria-label="Weekly shift totals">
            <span><strong>{shifts.length}</strong> shifts</span>
            <span><strong>{assigned}</strong> assigned</span>
            <span className="shift-planner__open"><strong>{shifts.length - assigned}</strong> open</span>
          </div>
          <button type="button" className="btn btn--ghost shift-planner__filter" aria-pressed={openOnly} onClick={() => setOpenOnly((value) => !value)}>Open shifts only</button>
          <button type="button" className="btn btn--ghost" disabled title="Draft creation is not available in this screen preview">Create draft</button>
        </div>
      </div>

      {view === "day" && (
        <div className="shift-planner__days" role="group" aria-label="Choose a day">
          {days.map((day) => <button type="button" key={day.offset} aria-pressed={selectedDay === day.offset} onClick={() => setSelectedDay(day.offset)}>
            {format(day.date, { weekday: "short", day: "numeric", month: "short" })}
          </button>)}
        </div>
      )}

      <div className={`shift-planner__board ${view === "day" ? "shift-planner__board--day" : ""}`} tabIndex={0} role="region" aria-label="Shift cards by day">
        {visibleDays.map(({ offset, date, shifts: dayShifts }) => {
          const dayAssigned = dayShifts.filter((shift) => shift[2]).length;
          const shownShifts = openOnly ? dayShifts.filter((shift) => !shift[2]) : dayShifts;
          return (
            <article className="shift-planner__column" key={offset} aria-label={format(date, { weekday: "long", day: "numeric", month: "long" })}>
              <header className="shift-planner__column-head">
                <h3>{format(date, { weekday: "long" })}</h3>
                <time dateTime={date.toISOString().slice(0, 10)}>{format(date, { day: "numeric", month: "long", year: "numeric" })}</time>
                <span className="shift-planner__assigned">{dayAssigned}/{dayShifts.length} assigned</span>
                <div className="shift-planner__progress" aria-hidden="true"><span style={{ width: dayShifts.length ? `${dayAssigned / dayShifts.length * 100}%` : "0%" }} /></div>
              </header>
              <ul className="shift-planner__shifts">
                {shownShifts.map(([from, to, name], index) => (
                  <li className="shift-planner__shift" key={`${offset}-${index}`}>
                    <span className="shift-planner__time">{from} – {to}</span>
                    <span className="shift-planner__person"><CheckCircle2 size={17} aria-hidden="true" /><strong>{name || "Open shift"}</strong></span>
                  </li>
                ))}
              </ul>
              {!shownShifts.length && <div className="shift-planner__empty"><CalendarDays size={23} aria-hidden="true" /><p>{openOnly ? "No open shifts" : "No shifts scheduled"}</p></div>}
            </article>
          );
        })}
      </div>
      <p className="shift-planner__note">Sample names and shifts from the reference design. Draft creation and publishing are not enabled yet.</p>
    </section>
  );
}
