import { useEffect, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import "./ShiftPlannerPage.css";

const PLANNER_URL = "https://anastanjohnson.github.io/karikaala-staff-planner-web/?release=7f75b61";

export default function ShiftPlannerPage() {
  const [instance, setInstance] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(timer);
  }, [instance]);
  const reload = () => {
    setLoaded(false);
    setSlow(false);
    setInstance(value => value + 1);
  };
  return (
    <section className="shift-planner" aria-label="Shift Planner">
      <header className="dashboard__header shift-planner__header">
        <div>
          <h1>Shift Planner</h1>
          <p className="dashboard__subtitle">Plan shifts, manage availability, publish rosters and message your team.</p>
        </div>
        <div className="shift-planner__actions">
          <button className="btn btn--ghost" type="button" onClick={reload} aria-label="Reload planner">
            <RotateCw size={16} aria-hidden="true" /> Reload
          </button>
          <a className="btn btn--ghost" href={PLANNER_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Open separately
          </a>
        </div>
      </header>
      <p className="shift-planner__help">Use your existing staff planner login. Changes sync with the staff planner website and app.</p>
      {!loaded && <p role="status" className="shift-planner__status">{slow ? "Taking longer than expected. You can reload or open the planner separately." : "Loading staff planner…"}</p>}
      <div className="shift-planner__workspace">
        <iframe
          key={instance}
          src={PLANNER_URL}
          title="KARIKAALA live staff planner"
          className="shift-planner__frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </section>
  );
}
