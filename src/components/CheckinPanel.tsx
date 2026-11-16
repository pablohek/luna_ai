import { Heart } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Checkin } from "../types";
import { formatDate } from "../lib/dates";

const moods = [
  "Unspecified",
  "Happy",
  "Calm",
  "Tired",
  "Low",
  "Irritable",
  "Anxious",
];
const symptoms = [
  "Cramps",
  "Headache",
  "Bloating",
  "Acne",
  "Fatigue",
  "Tender breasts",
  "Back pain",
];

export default function CheckinPanel({
  day,
  today,
  existing,
  busy,
  onSave,
  onRemove,
}: {
  day: string;
  today: string;
  existing?: Checkin;
  busy: boolean;
  onSave: (entry: Checkin) => void;
  onRemove: () => void;
}) {
  const [mood, setMood] = useState(existing?.mood ?? "Unspecified");
  const [selected, setSelected] = useState(existing?.symptoms ?? []);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ day, mood, symptoms: selected });
  }
  return (
    <section className="panel checkin-panel" aria-labelledby="checkin-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">{formatDate(day, { weekday: "long" })}</p>
          <h2 id="checkin-title">Daily check-in</h2>
        </div>
        <div className="metric-icon blush">
          <Heart size={19} />
        </div>
      </div>
      {day > today ? (
        <p className="muted">Choose today or an earlier date to check in.</p>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <label>
            Mood
            <select
              value={mood}
              onChange={(event) => setMood(event.target.value)}
            >
              {moods.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Symptoms</legend>
            <div className="chips">
              {symptoms.map((symptom) => (
                <label className="chip" key={symptom}>
                  <input
                    type="checkbox"
                    checked={selected.includes(symptom)}
                    onChange={(event) => {
                      setSelected(
                        event.target.checked
                          ? [...selected, symptom]
                          : selected.filter((value) => value !== symptom),
                      );
                    }}
                  />
                  <span>{symptom}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button className="primary-btn" disabled={busy}>
              Save check-in
            </button>
            {existing && (
              <button
                type="button"
                className="text-btn"
                disabled={busy}
                onClick={onRemove}
              >
                Remove check-in
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
