"""Descriptive calendar forecast. No learned model or probability claim."""

from datetime import date, timedelta
from statistics import mean, median


def summarize(periods: list[dict], today: date) -> dict:
    starts = [p["start"] for p in periods]
    intervals = [(right - left).days for left, right in zip(starts, starts[1:])]
    durations = [(p["end"] - p["start"]).days + 1 for p in periods if p["end"]]
    recent = intervals[-6:]
    result = {
        "cycles": intervals,
        "average_cycle": round(mean(intervals), 1) if intervals else None,
        "average_period": round(mean(durations), 1) if durations else None,
        "cycle_day": (today - starts[-1]).days + 1 if starts else None,
        "forecast": None,
    }
    if len(recent) < 2:
        result["forecast_status"] = "insufficient"
        return result

    typical = round(median(recent))
    spread = max(3, max(abs(length - typical) for length in recent))
    center = starts[-1] + timedelta(days=typical)
    lower, upper = center - timedelta(days=spread), center + timedelta(days=spread)
    if upper < today:
        result["forecast_status"] = "elapsed"
        return result

    result["forecast_status"] = "available"
    result["forecast"] = {
        "center": center,
        "start": lower,
        "end": upper,
        "intervals_used": len(recent),
        "typical_days": typical,
        "method": "median_recent_intervals_v1",
    }
    return result
