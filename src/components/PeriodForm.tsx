import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { Period } from "../types";
import { message } from "../lib/api";

export default function PeriodForm({
  existing,
  initialDay,
  today,
  onClose,
  onSave,
}: {
  existing?: Period;
  initialDay: string;
  today: string;
  onClose: () => void;
  onSave: (start: string, end: string | null) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(existing?.start ?? initialDay);
  const [end, setEnd] = useState(existing?.end ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(start, end || null);
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="period-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-top">
        <h2 id="period-title">{existing ? "Edit period" : "Log a period"}</h2>
        <button
          className="icon-btn"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted">
        Leave the end date blank if your period is ongoing.
      </p>
      <form onSubmit={save}>
        <label>
          Start date
          <input
            type="date"
            value={start}
            max={today}
            required
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={end}
            min={start}
            max={today}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary-btn" disabled={busy}>
          {busy ? "Saving…" : "Save period"}
        </button>
      </form>
    </dialog>
  );
}
