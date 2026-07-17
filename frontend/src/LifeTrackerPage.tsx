import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconDice, IconMinus, IconPlus, IconRefresh, IconX } from "@tabler/icons-react";

const STARTING_LIFE = 20;
const WINNER_HIGHLIGHT_MS = 5000;

// A two-player life counter meant for a phone lying flat between both players:
// the screen splits in half and the top half is rotated 180° so it reads right
// way up from the far side of the table. Rendered outside the app Layout so the
// nav chrome doesn't eat the halves. Totals are local and ephemeral.
export function LifeTrackerPage() {
  const [life, setLife] = useState<[number, number]>([STARTING_LIFE, STARTING_LIFE]);
  // Who was picked to go first, and a stamp so re-rolling to the same player
  // still restarts the highlight window.
  const [winner, setWinner] = useState<{ player: 0 | 1; at: number } | null>(null);

  // Auto-fade so we don't leave a stale highlight around forever.
  useEffect(() => {
    if (!winner) return;
    const t = setTimeout(() => setWinner(null), WINNER_HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [winner]);

  const bump = (player: 0 | 1, delta: number) => {
    setLife((l) => (player === 0 ? [l[0] + delta, l[1]] : [l[0], l[1] + delta]));
  };

  const reset = () => {
    setLife([STARTING_LIFE, STARTING_LIFE]);
    setWinner(null);
  };

  const rollFirstPlayer = () => {
    setWinner({ player: Math.random() < 0.5 ? 0 : 1, at: Date.now() });
  };

  return (
    <main className="life-tracker-page">
      <LifeHalf
        player={1}
        life={life[1]}
        flipped
        highlighted={winner?.player === 1}
        onBump={(d) => bump(1, d)}
      />

      <div className="life-tracker-divider">
        <button className="life-tracker-action" aria-label="Reset both players to 20" onClick={reset}>
          <IconRefresh size={18} stroke={2} />
        </button>
        <button
          className="life-tracker-action primary"
          aria-label="Randomly pick who plays first"
          onClick={rollFirstPlayer}
        >
          <IconDice size={18} stroke={2} />
        </button>
        <Link to="/" className="life-tracker-action" aria-label="Exit life tracker">
          <IconX size={18} stroke={2} />
        </Link>
      </div>

      <LifeHalf
        player={0}
        life={life[0]}
        highlighted={winner?.player === 0}
        onBump={(d) => bump(0, d)}
      />
    </main>
  );
}

// One player's side: a colored "card" holds two big tap targets - left
// subtracts, right adds - with the total sitting on top. `flipped` rotates the
// half for the player sitting opposite, which flips its left/right along with
// it. Each player gets a distinct color so the two halves look like a pair of
// cards facing each other across the table.
function LifeHalf({
  player,
  life,
  flipped,
  highlighted,
  onBump,
}: {
  player: 0 | 1;
  life: number;
  flipped?: boolean;
  highlighted?: boolean;
  onBump: (delta: number) => void;
}) {
  const dead = life <= 0;
  const label = `Player ${player + 1}`;
  const color = player === 0 ? "red" : "blue";

  return (
    <section
      className={`life-tracker-half life-tracker-half-${color} ${flipped ? "flipped" : ""} ${dead ? "dead" : ""} ${highlighted ? "highlighted" : ""}`}
    >
      <div className="life-tracker-card">
        <button className="life-tracker-zone" aria-label={`${label}: lose 1 life`} onClick={() => onBump(-1)}>
          <IconMinus size={28} stroke={2.5} />
        </button>
        <button className="life-tracker-zone" aria-label={`${label}: gain 1 life`} onClick={() => onBump(1)}>
          <IconPlus size={28} stroke={2.5} />
        </button>
        <div className="life-tracker-total">{life}</div>
      </div>
    </section>
  );
}
