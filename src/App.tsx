import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Heart,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import Calendar from "./components/Calendar";
import CheckinPanel from "./components/CheckinPanel";
import Landing, { Brand } from "./components/Landing";
import PeriodForm from "./components/PeriodForm";
import Settings from "./components/Settings";
import type { Dashboard, Period, User } from "./types";
import { daysBetween, formatDate } from "./lib/dates";
import { api, ApiError, message } from "./lib/api";

export default function App() {
  const [user, setUser] = useState<User | null>();
  const [error, setError] = useState("");
  const exit = useCallback(() => setUser(null), []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<User>("/me")
      .then((result) => {
        if (active) setUser(result);
      })
      .catch((problem) => {
        if (!active) return;
        if (problem instanceof ApiError && problem.status === 401)
          setUser(null);
        else setError(message(problem));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (user === undefined)
    return (
      <main className="auth-layout">
        {error ? (
          <div className="panel" role="alert">
            {error}{" "}
            <button
              className="text-btn"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <p role="status">Opening LUNA…</p>
        )}
      </main>
    );
  return user ? (
    <Journal key={user.id} user={user} onUpdated={setUser} onExit={exit} />
  ) : (
    <Landing onAuth={setUser} />
  );
}

function Journal({
  user,
  onUpdated,
  onExit,
}: {
  user: User;
  onUpdated: (user: User) => void;
  onExit: () => void;
}) {
  const [data, setData] = useState<Dashboard>();
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Period | "new">();
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<Dashboard>("/dashboard")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((problem) => {
        if (!active) return;
        if (problem instanceof ApiError && problem.status === 401) onExit();
        else setFeedback({ error: true, text: message(problem) });
      });
    return () => {
      active = false;
    };
  }, [attempt, onExit, user.timezone]);

  async function mutate(
    action: () => Promise<unknown>,
    success: string,
    afterSave?: () => void,
  ) {
    setBusy(true);
    setFeedback(undefined);
    try {
      await action();
      afterSave?.();
      setFeedback({ error: false, text: success });
      setAttempt((attempt) => attempt + 1);
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) onExit();
      throw problem;
    } finally {
      setBusy(false);
    }
  }

  function act(action: () => Promise<unknown>, success: string) {
    void mutate(action, success).catch((problem) =>
      setFeedback({ error: true, text: message(problem) }),
    );
  }

  function logout() {
    void mutate(() => api("/auth/logout", "POST"), "", onExit).catch(
      (problem) => {
        setFeedback({ error: true, text: message(problem) });
      },
    );
  }

  const day = selected || data?.today || "";
  const checkin = data?.checkins.find((entry) => entry.day === day);
  const periodOnDay = data?.periods.find(
    (period) => day >= period.start && day <= (period.end ?? data.today),
  );
  const forecast = data?.summary.forecast;
  const status = data?.summary.forecast_status;
  const forecastNote = forecast
    ? `Based on the median of ${forecast.intervals_used} recent start-to-start intervals.`
    : status === "elapsed"
      ? "Your last estimated window has passed. Update your period log to refresh it."
      : "Log three period starts to get your first estimate.";
  const nav = (
    <>
      <a className="nav-link" href="#overview">
        <Activity size={18} /> Overview
      </a>
      <a className="nav-link" href="#calendar">
        <CalendarDays size={18} /> Calendar
      </a>
      <a className="nav-link" href="#history">
        <Heart size={18} /> History
      </a>
      <a className="nav-link" href="#settings">
        <SettingsIcon size={18} /> Settings
      </a>
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="nav-group" aria-label="Journal">
          {nav}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <LockKeyhole size={18} />
            <strong>Private cycle journal</strong>
          </div>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar-brand">
            <Brand />
          </div>
          <div className="topbar-right">
            <span className="avatar" aria-hidden="true">
              {Array.from(user.name)[0].toUpperCase()}
            </span>
            <button className="secondary-btn" disabled={busy} onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Journal">
          {nav}
        </nav>
        <div className="main-inner">
          <section className="welcome" id="overview">
            <div>
              <p className="eyebrow">YOUR CYCLE JOURNAL</p>
              <h1>
                Hello, <em>{user.name}.</em>
              </h1>
              <p className="subtitle">
                See where you are in your cycle and log how you feel.
              </p>
            </div>
            {data && (
              <button
                className="primary-btn"
                disabled={busy}
                onClick={() => setEditing("new")}
              >
                <Plus size={18} /> Log period
              </button>
            )}
          </section>
          {feedback && (
            <div
              className={feedback.error ? "flash error-flash" : "flash"}
              role={feedback.error ? "alert" : "status"}
            >
              {feedback.text}
              <button
                aria-label="Dismiss"
                onClick={() => setFeedback(undefined)}
              >
                ×
              </button>
            </div>
          )}
          {!data ? (
            feedback ? (
              <button
                className="secondary-btn"
                onClick={() => {
                  setFeedback(undefined);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry loading journal
              </button>
            ) : (
              <p role="status">Loading your journal…</p>
            )
          ) : (
            <>
              <div className="metrics">
                <div className="metric">
                  <div className="metric-icon blush">
                    <CalendarDays size={20} />
                  </div>
                  <span>Estimated next start</span>
                  <strong>
                    {forecast
                      ? `${formatDate(forecast.start)} – ${formatDate(forecast.end)}`
                      : "No estimate yet"}
                  </strong>
                  <small>
                    Statistical baseline ·{" "}
                    {forecast
                      ? `Midpoint ${formatDate(forecast.center)}`
                      : status === "elapsed"
                        ? "Window elapsed"
                        : "More history needed"}
                  </small>
                </div>
                <div className="metric">
                  <div className="metric-icon violet">
                    <Activity size={20} />
                  </div>
                  <span>Average cycle length</span>
                  <strong>
                    {data.summary.average_cycle === null
                      ? "—"
                      : `${data.summary.average_cycle} days`}
                  </strong>
                  <small>From one period start to the next</small>
                </div>
                <div className="metric">
                  <div className="metric-icon peach">
                    <Heart size={20} />
                  </div>
                  <span>Current cycle day</span>
                  <strong>
                    {data.summary.cycle_day === null
                      ? "—"
                      : `Day ${data.summary.cycle_day}`}
                  </strong>
                  <small>Since the most recent logged start</small>
                </div>
              </div>
              <div className="dashboard-grid">
                <Calendar data={data} selected={day} onSelect={setSelected} />
                <div className="right-column">
                  <CheckinPanel
                    key={JSON.stringify([day, checkin])}
                    day={day}
                    today={data.today}
                    existing={checkin}
                    busy={busy}
                    onSave={(entry) => {
                      const { day, ...values } = entry;
                      act(
                        () => api("/checkins/" + day, "PUT", values),
                        "Check-in saved.",
                      );
                    }}
                    onRemove={() =>
                      act(
                        () => api("/checkins/" + day, "DELETE"),
                        "Check-in removed.",
                      )
                    }
                  />
                  {day <= data.today && (
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => setEditing(periodOnDay ?? "new")}
                    >
                      <CalendarDays size={16} />{" "}
                      {periodOnDay
                        ? "Edit period on this day"
                        : `Log period for ${formatDate(day)}`}
                    </button>
                  )}
                  <section className="panel insight-panel">
                    <p className="eyebrow">STATISTICAL BASELINE</p>
                    <h2>How the estimate works</h2>
                    <p>{forecastNote}</p>
                    <div className="hint">
                      The window is approximate. It cannot determine fertility
                      or guide contraception.
                    </div>
                  </section>
                </div>
              </div>
              <section className="panel history-panel" id="history">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">YOUR RECORDS</p>
                    <h2>Cycle history</h2>
                  </div>
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => setEditing("new")}
                  >
                    <Plus size={17} /> Add period
                  </button>
                </div>
                <div className="quick-row">
                  <span>Average finished period</span>
                  <strong>
                    {data.summary.average_period ?? "—"}
                    {data.summary.average_period !== null && " days"}
                  </strong>
                </div>
                <div className="quick-row">
                  <span>Recent cycle lengths</span>
                  <strong>
                    {data.summary.cycles
                      .slice(-6)
                      .map((length) => `${length}d`)
                      .join(" · ") || "—"}
                  </strong>
                </div>
                <div className="quick-row">
                  <span>Daily check-ins</span>
                  <strong>{data.checkins.length}</strong>
                </div>
                {data.periods.length === 0 ? (
                  <div className="empty">
                    <CalendarDays size={28} />
                    <strong>No periods logged yet</strong>
                  </div>
                ) : (
                  <div className="history-list">
                    {[...data.periods].reverse().map((period) => (
                      <div className="history-row" key={period.id}>
                        <div className="record-icon">
                          <Heart size={18} />
                        </div>
                        <div className="record-info">
                          <strong>
                            {formatDate(period.start, { year: "numeric" })}
                            {period.end &&
                              ` – ${formatDate(period.end, { year: "numeric" })}`}
                          </strong>
                          <small>
                            {period.end
                              ? `${daysBetween(period.start, period.end) + 1} days recorded`
                              : "Ongoing"}
                          </small>
                        </div>
                        <button
                          className="icon-btn"
                          aria-label={
                            period.end ? "Edit period" : "End ongoing period"
                          }
                          disabled={busy}
                          onClick={() => setEditing(period)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-btn danger"
                          aria-label="Delete period"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Delete this period entry?"))
                              act(
                                () => api("/periods/" + period.id, "DELETE"),
                                "Period deleted.",
                              );
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <Settings user={user} onUpdated={onUpdated} onDeleted={onExit} />
              {editing && (
                <PeriodForm
                  existing={editing === "new" ? undefined : editing}
                  today={data.today}
                  initialDay={day <= data.today ? day : data.today}
                  onClose={() => setEditing(undefined)}
                  onSave={(start, end) =>
                    mutate(
                      () =>
                        api(
                          editing === "new"
                            ? "/periods"
                            : "/periods/" + editing.id,
                          editing === "new" ? "POST" : "PUT",
                          { start, end },
                        ),
                      "Period saved.",
                      () => setEditing(undefined),
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
