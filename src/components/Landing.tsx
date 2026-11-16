import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  LockKeyhole,
  MoonStar,
  Sparkles,
} from "lucide-react";
import { api, message } from "../lib/api";
import type { User } from "../types";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <MoonStar size={22} />
      </span>
      <span>
        LUNA<span className="brand-ai"> AI</span>
      </span>
    </span>
  );
}

type Mode = "login" | "register";

export default function Landing({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(next: Mode | null) {
    setError("");
    setMode(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: form.get("email"),
      password: form.get("password"),
    };
    const profile = {
      name: form.get("name"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    };
    try {
      onAuth(
        await api<User>(
          "/auth/" + mode,
          "POST",
          mode === "register" ? { ...credentials, ...profile } : credentials,
        ),
      );
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <button
          className="brand-button"
          aria-label="LUNA AI home"
          disabled={busy}
          onClick={() => choose(null)}
        >
          <Brand />
        </button>
        <div className="flex items-center gap-3">
          <button
            className="secondary-btn"
            disabled={busy}
            onClick={() => choose("login")}
          >
            Sign in
          </button>
          <button
            className="primary-btn header-cta"
            disabled={busy}
            onClick={() => choose("register")}
          >
            Get started <ArrowRight size={15} />
          </button>
        </div>
      </header>
      {mode ? (
        <main className="auth-layout">
          <section className="panel auth-card">
            <span className="brand-symbol">
              <MoonStar size={22} />
            </span>
            <h1>
              {mode === "register" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="muted">
              {mode === "register"
                ? "Start logging your cycle in a private account."
                : "Sign in to open your cycle journal."}
            </p>
            <form onSubmit={submit} key={mode} className="form-stack">
              {mode === "register" && (
                <label>
                  Name
                  <input
                    name="name"
                    autoComplete="given-name"
                    maxLength={60}
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={mode === "register" ? 12 : undefined}
                  maxLength={128}
                  required
                />
              </label>
              {mode === "register" && (
                <small className="muted">Use at least 12 characters.</small>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-btn" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <button
              className="text-btn auth-switch"
              disabled={busy}
              onClick={() => choose(mode === "register" ? "login" : "register")}
            >
              {mode === "register"
                ? "Already have an account? Sign in"
                : "New to LUNA? Create an account"}
            </button>
          </section>
        </main>
      ) : (
        <main>
          <section className="landing-hero">
            <div className="hero-copy">
              <p className="eyebrow">
                <Heart size={14} /> YOUR PRIVATE CYCLE JOURNAL
              </p>
              <h1>
                Find your
                <br />
                <em>own rhythm.</em>
              </h1>
              <p>
                Log periods, check in with how you feel, and see your cycle
                patterns in one place.
              </p>
              <button
                className="primary-btn"
                onClick={() => choose("register")}
              >
                Start tracking <ArrowRight size={18} />
              </button>
              <small>
                <LockKeyhole size={15} /> Your journal is accessible through
                your account.
              </small>
            </div>
            <div
              className="hero-art"
              role="img"
              aria-label="A crescent moon with orbital rings on a lavender and pink background"
            >
              <div className="orbit orbit-wide" />
              <div className="orbit orbit-small" />
              <div className="moon">
                <MoonStar size={132} strokeWidth={0.75} />
              </div>
              <Sparkles
                className="sparkle sparkle-top"
                size={32}
                strokeWidth={1.2}
              />
              <Sparkles
                className="sparkle sparkle-bottom"
                size={22}
                strokeWidth={1.2}
              />
            </div>
          </section>
          <section className="landing-features" aria-label="Features">
            <div>
              <CalendarDays />
              <h2>Cycle calendar</h2>
              <p>See your logged days and estimated next start.</p>
            </div>
            <div>
              <Heart />
              <h2>Daily check-ins</h2>
              <p>Record symptoms and mood alongside your cycle.</p>
            </div>
            <div>
              <LockKeyhole />
              <h2>Data controls</h2>
              <p>Export your journal or delete your account in settings.</p>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
