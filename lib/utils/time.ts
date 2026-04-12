export function formatDuration(mins: number): string {
  if (mins <= 0) return "0m";

  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;

  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}
