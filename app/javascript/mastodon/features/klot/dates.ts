// Day arithmetic for Klot, on plain `YYYY-MM-DD` strings in the member's
// own time zone. A period is logged against the day it is where they are,
// so nothing here goes through UTC.

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromIso = (iso: string): Date => new Date(`${iso}T00:00:00`);

export const todayIso = (): string => toIso(new Date());

export const addDays = (iso: string, days: number): string => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

// Whole days from `a` to `b` (negative when `b` is earlier).
export const daysBetween = (a: string, b: string): number =>
  Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);

export interface Month {
  year: number;
  month: number; // 0-11
}

export const monthOf = (iso: string): Month => {
  const d = fromIso(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const shiftMonth = ({ year, month }: Month, by: number): Month => {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

// The days a month's grid shows: whole weeks, Monday first, so it starts
// in the month before and ends in the month after as needed.
export const monthGrid = ({ year, month }: Month): string[] => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const start = toIso(new Date(year, month, 1 - lead));
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
};
