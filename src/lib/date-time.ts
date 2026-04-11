const durationFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MOSCOW_TIMEZONE = "Europe/Moscow";

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${Math.max(totalSeconds, 0)} сек`;
  }

  if (totalSeconds < 3600) {
    return `${Math.round(totalSeconds / 60)} мин`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export function formatPercent(value: number): string {
  return `${durationFormatter.format(value)}%`;
}

export function formatTimeOfDay(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function parseTimeOfDay(value: string): number | null {
  const normalized = value.trim().replace(".", ":");
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function getMoscowTimeMinutes(date = new Date()): number {
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function getStartOfMoscowDay(date = new Date()): Date {
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MS);

  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - MOSCOW_OFFSET_MS,
  );
}

export function daysUntil(targetDate: Date, from = new Date()): number {
  const diffMs = targetDate.getTime() - from.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const dayOfMonth = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return result;
}

export function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}
