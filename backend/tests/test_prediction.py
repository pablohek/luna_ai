from datetime import date, timedelta

from luna.prediction import summarize


def history(lengths, first=date(2026, 1, 1)):
    periods = [{"start": first, "end": first + timedelta(days=4)}]
    for days in lengths:
        start = periods[-1]["start"] + timedelta(days=days)
        periods.append({"start": start, "end": start + timedelta(days=4)})
    return periods


def test_no_estimate_until_three_starts():
    today = date(2026, 2, 2)
    assert summarize([], today)["cycle_day"] is None
    assert summarize(history([28]), today)["forecast_status"] == "insufficient"


def test_median_recent_intervals_and_minimum_window():
    periods = history([90, 27, 29, 28, 28, 30, 28])
    last = periods[-1]["start"]
    summary = summarize(periods, last + timedelta(days=3))
    forecast = summary["forecast"]
    assert forecast["center"] == last + timedelta(days=28)
    assert forecast["start"] == last + timedelta(days=25)
    assert forecast["end"] == last + timedelta(days=31)
    assert forecast["intervals_used"] == 6
    assert summary["cycle_day"] == 4


def test_variable_intervals_widen_window_and_expired_estimate_is_hidden():
    periods = history([18, 42])
    last = periods[-1]["start"]
    result = summarize(periods, last)
    assert result["forecast"]["start"] == last + timedelta(days=18)
    assert result["forecast"]["end"] == last + timedelta(days=42)
    assert summarize(periods, last + timedelta(days=43))["forecast_status"] == "elapsed"


def test_open_period_excluded_from_average_duration():
    periods = history([28, 30])
    periods[-1]["end"] = None
    assert summarize(periods, periods[-1]["start"])["average_period"] == 5
