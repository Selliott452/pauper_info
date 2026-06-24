// Color for a win-rate percentage: green for favorable, red for unfavorable,
// grey-ish around even. Shared by the archetype list and detail pages.
export function winrateColor(winrate: number): string {
  if (winrate >= 53) return "#16a34a";
  if (winrate <= 47) return "#dc2626";
  return "#9aa0a6";
}
