import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function StatCard({ icon: Icon, label, value, deltaPct, direction }) {
    const isUp = direction === "up";
    return (
        <div className="stat-card">
              <div className="stat-card__head">
                      <span className="stat-card__label">{label}</span>
                      <span className="stat-card__icon">
                                <Icon size={16} />
                      </span>
              </div>
              <div className="stat-card__value">{value}</div>
              <div className={`stat-card__delta ${isUp ? "stat-card__delta--up" : "stat-card__delta--down"}`}>
                {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span>{Math.abs(deltaPct)}% from last period</span>
              </div>
        </div>
        );
}
