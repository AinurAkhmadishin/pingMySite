const durationFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

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
