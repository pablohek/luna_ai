export type User = {
  id: number;
  name: string;
  email: string;
  timezone: string;
};
export type Period = { id: number; start: string; end: string | null };
export type Checkin = { day: string; mood: string; symptoms: string[] };
export type Forecast = {
  center: string;
  start: string;
  end: string;
  typical_days: number;
  intervals_used: number;
};
export type Dashboard = {
  today: string;
  periods: Period[];
  checkins: Checkin[];
  summary: {
    cycle_day: number | null;
    average_cycle: number | null;
    average_period: number | null;
    cycles: number[];
    forecast: Forecast | null;
    forecast_status: "available" | "insufficient" | "elapsed";
  };
};
