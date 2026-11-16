import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Dashboard } from "../types";
import {
  addDays,
  formatDate,
  monthStart,
  parseDate,
  shiftMonth,
} from "../lib/dates";

export default function Calendar({
  data,
  selected,
  onSelect,
}: {
  data: Dashboard;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(monthStart(selected));
  const begin = parseDate(month);
  const offset = (begin.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(begin.getUTCFullYear(), begin.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) => addDays(month, index - offset),
  );
  const forecast = data.summary.forecast;
  const checkins = new Set(data.checkins.map((entry) => entry.day));

  function select(day: string) {
    onSelect(day);
    setMonth(monthStart(day));
  }

  return (
    <section className="panel calendar-panel" id="calendar">
      <div className="section-head">
        <div>
          <p className="eyebrow">TRACK YOUR RHYTHM</p>
          <h2>Cycle calendar</h2>
        </div>
        <div className="calendar-nav">
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft size={20} />
          </button>
          <strong aria-live="polite">
            {formatDate(month, {
              month: "long",
              year: "numeric",
              day: undefined,
            })}
          </strong>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {cells.map((day) => {
          const logged = data.periods.some(
            (period) =>
              day >= period.start && day <= (period.end ?? data.today),
          );
          const estimated =
            !logged && forecast && day >= forecast.start && day <= forecast.end;
          const checked = checkins.has(day);
          return (
            <button
              key={day}
              className={[
                "day",
                !day.startsWith(month.slice(0, 7)) && "outside",
                logged && "logged",
                estimated && "predicted",
                day === data.today && "today",
                checked && "checked",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={[
                formatDate(day, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                }),
                logged
                  ? "Logged period"
                  : estimated
                    ? "Estimated start window"
                    : "",
                checked ? "Check-in saved" : "",
              ]
                .filter(Boolean)
                .join(", ")}
              aria-current={day === data.today ? "date" : undefined}
              aria-pressed={selected === day}
              onClick={() => select(day)}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span>
          <i className="dot pink" /> Logged period
        </span>
        <span>
          <i className="dot lilac" /> Estimated start
        </span>
        <span>
          <i className="dot checkin-dot" /> Check-in
        </span>
        <button className="text-btn" onClick={() => select(data.today)}>
          Today
        </button>
      </div>
    </section>
  );
}
