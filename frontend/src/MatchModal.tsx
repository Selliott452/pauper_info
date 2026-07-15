import { useState } from "react";
import { ComboBox } from "./ComboBox";
import { Modal } from "./Modal";
import type { CasualMatchView, CreateCasualMatch } from "./api";

const numInput = { width: 48, padding: "0.3rem 0.4rem", textAlign: "center" as const };

// Local YYYY-MM-DD.
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function today(): string {
  return toISODate(new Date());
}

// Shared create/edit form for a casual match. Passing `initial` switches it into
// edit mode (title + field defaults); used by both the matches page and a player's
// match history.
export function MatchModal({
  initial,
  playerNames,
  archetypeNames,
  submitting,
  error,
  onSubmit,
  onClose,
}: {
  initial: CasualMatchView | null;
  playerNames: string[];
  archetypeNames: string[];
  submitting: boolean;
  error: string | null;
  onSubmit: (body: CreateCasualMatch) => void;
  onClose: () => void;
}) {
  const [p1, setP1] = useState(initial?.player1Name ?? "");
  const [p2, setP2] = useState(initial?.player2Name ?? "");
  const [p1w, setP1w] = useState(initial ? String(initial.player1Wins) : "");
  const [p2w, setP2w] = useState(initial ? String(initial.player2Wins) : "");
  const [draws, setDraws] = useState(initial ? String(initial.draws) : "");
  const [p1arch, setP1arch] = useState(initial?.player1Archetype ?? "");
  const [p2arch, setP2arch] = useState(initial?.player2Archetype ?? "");
  const [p1deck, setP1deck] = useState(initial?.player1DeckUrl ?? "");
  const [p2deck, setP2deck] = useState(initial?.player2DeckUrl ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const valid = p1.trim() && p2.trim() && p1.trim().toLowerCase() !== p2.trim().toLowerCase() && (p1w !== "" || p2w !== "");

  const field = { width: "100%", boxSizing: "border-box" as const, marginBottom: "0.5rem", display: "block" };
  const colHeader = { fontWeight: 600 as const, marginBottom: "0.4rem" };

  return (
    <Modal width={460} onClose={onClose}>
        <h3 style={{ margin: "0 0 1rem" }}>{initial ? "Edit match" : "Record a match"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1rem" }}>
          <div>
            <div style={colHeader}>Player 1</div>
            <div style={{ marginBottom: "0.5rem" }}>
              <ComboBox value={p1} onChange={setP1} options={playerNames} placeholder="Name" block />
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <ComboBox value={p1arch} onChange={setP1arch} options={archetypeNames} placeholder="Archetype" block />
            </div>
            <input className="text-input" placeholder="Deck link" value={p1deck} onChange={(e) => setP1deck(e.target.value)} style={field} />
          </div>
          <div>
            <div style={colHeader}>Player 2</div>
            <div style={{ marginBottom: "0.5rem" }}>
              <ComboBox value={p2} onChange={setP2} options={playerNames} placeholder="Name" block />
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <ComboBox value={p2arch} onChange={setP2arch} options={archetypeNames} placeholder="Archetype" block />
            </div>
            <input className="text-input" placeholder="Deck link" value={p2deck} onChange={(e) => setP2deck(e.target.value)} style={field} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#555" }}>Games</span>
            <input className="text-input" style={numInput} type="number" min={0} placeholder="–" value={p1w} onChange={(e) => setP1w(e.target.value)} />
            <span>–</span>
            <input className="text-input" style={numInput} type="number" min={0} placeholder="–" value={p2w} onChange={(e) => setP2w(e.target.value)} />
          </span>
          <label style={{ fontSize: "0.85rem", color: "#555", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            Draws
            <input className="text-input" style={numInput} type="number" min={0} placeholder="0" value={draws} onChange={(e) => setDraws(e.target.value)} />
          </label>
          <label style={{ fontSize: "0.85rem", color: "#555", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            Date
            <input className="text-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <textarea
          className="text-input"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ ...field, resize: "vertical" }}
        />

        {error && <p style={{ color: "crimson", margin: "0 0 0.75rem" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="pill" onClick={onClose}>
            Cancel
          </button>
          <button
            className="pill active"
            disabled={!valid || submitting}
            style={{ opacity: valid ? 1 : 0.5 }}
            onClick={() =>
              onSubmit({
                player1: p1,
                player2: p2,
                player1Wins: Number(p1w) || 0,
                player2Wins: Number(p2w) || 0,
                draws: Number(draws) || 0,
                player1Archetype: p1arch || null,
                player2Archetype: p2arch || null,
                player1DeckUrl: p1deck || null,
                player2DeckUrl: p2deck || null,
                date: date || null,
                notes: notes || null,
              })
            }
          >
            Record match
          </button>
        </div>
    </Modal>
  );
}
