// Formatting helpers shared across pages.

// A 0..1 ratio as a one-decimal percentage, e.g. 0.5234 -> "52.3%".
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// Match/game win rate from a W-L-D record (draws count as games played, not won).
// Returns an em dash when no games have been played.
export function recordWinRate(wins: number, losses: number, draws: number): string {
  const total = wins + losses + draws;
  return total === 0 ? "—" : pct(wins / total);
}

// An average copy-count for display, or an em dash when unknown.
export function formatAvg(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

// Label for an archetype record whose archetype may be unknown (null).
export const archetypeLabel = (a: { archetype: string | null }) => a.archetype ?? "Unknown";
