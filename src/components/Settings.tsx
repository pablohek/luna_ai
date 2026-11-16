import { useState } from "react";
import type { FormEvent } from "react";
import { Download, ShieldCheck } from "lucide-react";
import type { User } from "../types";
import { api, message } from "../lib/api";

export default function Settings({
  user,
  onUpdated,
  onDeleted,
}: {
  user: User;
  onUpdated: (user: User) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string }>();
  const [confirming, setConfirming] = useState(false);
  async function perform(action: () => Promise<void>, success = "") {
    setBusy(true);
    setStatus(undefined);
    try {
      await action();
      if (success) setStatus({ error: false, text: success });
    } catch (problem) {
      setStatus({ error: true, text: message(problem) });
    } finally {
      setBusy(false);
    }
  }
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      onUpdated(
        await api<User>("/me", "PATCH", {
          name: data.get("name"),
          timezone: data.get("timezone"),
        }),
      );
    }, "Settings saved.");
  }
  function download() {
    void perform(async () => {
      const payload = await api<unknown>("/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "luna-data.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Export downloaded.");
  }
  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    void perform(async () => {
      await api("/me", "DELETE", { password });
      onDeleted();
    });
  }

  return (
    <section className="panel history-panel" id="settings">
      <div className="section-head">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h2>Settings & privacy</h2>
        </div>
        <ShieldCheck size={23} />
      </div>
      {status && (
        <p
          role={status.error ? "alert" : "status"}
          className={status.error ? "error" : "flash"}
        >
          {status.text}
        </p>
      )}
      <div className="settings-grid">
        <form className="form-stack" onSubmit={update}>
          <label>
            Email
            <input value={user.email} readOnly type="email" />
          </label>
          <label>
            Display name
            <input
              name="name"
              defaultValue={user.name}
              maxLength={60}
              required
            />
          </label>
          <label>
            Time zone
            <input
              name="timezone"
              defaultValue={user.timezone}
              maxLength={64}
              required
              aria-describedby="timezone-help"
            />
          </label>
          <small className="muted" id="timezone-help">
            Use an IANA time zone such as Asia/Kuala_Lumpur or UTC.
          </small>
          <button className="secondary-btn" disabled={busy}>
            Save settings
          </button>
        </form>
        <div className="form-stack">
          <h3>Your data</h3>
          <p className="muted">
            The JSON export contains your profile, period dates, moods and
            symptoms. Keep it somewhere private.
          </p>
          <button className="secondary-btn" disabled={busy} onClick={download}>
            <Download size={16} /> Export my data
          </button>
          {confirming ? (
            <form className="form-stack" onSubmit={remove}>
              <p className="muted">
                This permanently deletes your account, sessions and journal from
                the active database.
              </p>
              <label>
                Confirm password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="danger-btn" disabled={busy}>
                  Permanently delete account
                </button>
                <button
                  className="secondary-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              className="danger-btn"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Delete account
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
