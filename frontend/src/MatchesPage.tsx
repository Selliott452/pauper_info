import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ComboBox, MultiCombobox } from "./ComboBox";
import { Modal } from "./Modal";
import { downloadJson } from "./download";
import {
  createCasualMatch,
  deleteCasualMatch,
  fetchArchetypes,
  fetchCasualMatches,
  fetchCasualPlayerNames,
  updateCasualMatch,
  type CasualMatchView,
  type CreateCasualMatch,
} from "./api";

const numInput = { width: 48, padding: "0.3rem 0.4rem", textAlign: "center" as const };

// Local YYYY-MM-DD.
function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function today(): string {
  return toISODate(new Date());
}

type Period = "all" | "day" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "day", label: "Past day" },
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
  { key: "year", label: "Past year" },
];

// Earliest match date (inclusive) a given period should show, or null for "all time".
function periodCutoff(period: Period): string | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "day") d.setDate(d.getDate() - 1);
  else if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setMonth(d.getMonth() - 1);
  else if (period === "year") d.setFullYear(d.getFullYear() - 1);
  return toISODate(d);
}

export function MatchesPage() {
  const queryClient = useQueryClient();
  const { data: matches } = useQuery({ queryKey: ["casual-matches"], queryFn: fetchCasualMatches });
  const { data: playerNames } = useQuery({ queryKey: ["casual-players"], queryFn: fetchCasualPlayerNames });
  const { data: archetypeList } = useQuery({ queryKey: ["archetypes"], queryFn: fetchArchetypes, staleTime: Infinity });
  const archetypeNames = archetypeList?.map((a) => a.name) ?? [];

  // null = closed, "new" = create form, a match = edit that match.
  const [modal, setModal] = useState<CasualMatchView | "new" | null>(null);

  const [playerFilter, setPlayerFilter] = useState<string[]>([]);
  const [archFilter, setArchFilter] = useState<string[]>([]);
  const [period, setPeriod] = useState<Period>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredMatches = useMemo(() => {
    const cutoff = periodCutoff(period);
    return (matches ?? []).filter((m) => {
      if (playerFilter.length > 0) {
        const players = [m.player1Name, m.player2Name];
        if (!playerFilter.every((p) => players.includes(p))) return false;
      }
      if (archFilter.length > 0) {
        const archetypes = [m.player1Archetype, m.player2Archetype];
        if (!archFilter.every((a) => archetypes.includes(a))) return false;
      }
      if (cutoff && (!m.date || m.date < cutoff)) return false;
      return true;
    });
  }, [matches, playerFilter, archFilter, period]);

  const activeFilterCount = playerFilter.length + archFilter.length + (period !== "all" ? 1 : 0);
  const filtersActive = activeFilterCount > 0;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["casual-leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["casual-matches"] });
    queryClient.invalidateQueries({ queryKey: ["casual-players"] });
  }

  const save = useMutation({
    mutationFn: (v: { id: number | null; body: CreateCasualMatch }) =>
      v.id == null ? createCasualMatch(v.body) : updateCasualMatch(v.id, v.body),
    onSuccess: () => {
      refresh();
      setModal(null);
    },
  });

  const remove = useMutation({ mutationFn: deleteCasualMatch, onSuccess: refresh });

  return (
    <main className="page">
      <h1>Casual matches</h1>
      <p style={{ color: "#555", marginTop: 0 }}>One-off head-to-head matches, tracked separately from tournaments.</p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button className="pill active" onClick={() => setModal("new")}>
          Record match
        </button>
        {matches && matches.length > 0 && (
          <button className="pill push-end" onClick={() => downloadJson("casual-matches", matches)}>
            Export JSON
          </button>
        )}
      </div>

      {matches && matches.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <h2 style={{ margin: 0 }}>
              Recent matches{" "}
              <span style={{ color: "#999", fontWeight: 400, fontSize: "1rem" }}>
                ({filteredMatches.length === matches.length ? matches.length : `${filteredMatches.length} of ${matches.length}`})
              </span>
            </h2>
            <button className="pill push-end" onClick={() => setShowFilters((v) => !v)}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} {showFilters ? "▴" : "▾"}
            </button>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <MultiCombobox label="Players" options={playerNames ?? []} value={playerFilter} onChange={setPlayerFilter} placeholder="Filter by player" max={2} />
              <MultiCombobox label="Archetypes" options={archetypeNames} value={archFilter} onChange={setArchFilter} placeholder="Filter by archetype" max={2} />
              <div className="filter-row">
                <span className="filter-label">Period</span>
                {PERIODS.map((p) => (
                  <button key={p.key} className={`pill ${period === p.key ? "active" : ""}`} onClick={() => setPeriod(p.key)}>
                    {p.label}
                  </button>
                ))}
                {filtersActive && (
                  <button
                    className="pill push-end"
                    onClick={() => {
                      setPlayerFilter([]);
                      setArchFilter([]);
                      setPeriod("all");
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredMatches.length === 0 ? (
            <p style={{ color: "#666" }}>No matches for these filters.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {filteredMatches.map((m) => (
                <MatchRow key={m.id} match={m} onEdit={() => setModal(m)} onRemove={() => remove.mutate(m.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <NewMatchModal
          initial={modal === "new" ? null : modal}
          playerNames={playerNames ?? []}
          archetypeNames={archetypeNames}
          submitting={save.isPending}
          error={save.isError ? (save.error as Error).message : null}
          onClose={() => setModal(null)}
          onSubmit={(body) => save.mutate({ id: modal === "new" ? null : modal.id, body })}
        />
      )}
    </main>
  );
}

function NewMatchModal({
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

function MatchRow({ match: m, onEdit, onRemove }: { match: CasualMatchView; onEdit: () => void; onRemove: () => void }) {
  const score = `${m.player1Wins}-${m.player2Wins}${m.draws ? `-${m.draws}` : ""}`;
  const side = (name: string, id: number, arch: string | null, deck: string | null) => (
    <>
      <Link to={`/matches/players/${id}`}>{name}</Link>
      {arch && <span style={{ color: "#888", fontSize: "0.85rem" }}> ({arch})</span>}
      {deck && (
        <a href={deck} target="_blank" rel="noreferrer" style={{ marginLeft: 4, fontSize: "0.85rem" }}>
          ↗
        </a>
      )}
    </>
  );
  return (
    <div
      style={{
        padding: "0.4rem 0.75rem",
        border: "1px solid #ececec",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 200px" }}>
          {side(m.player1Name, m.player1Id, m.player1Archetype, m.player1DeckUrl)}{" "}
          <strong style={{ margin: "0 4px" }}>{score}</strong>{" "}
          {side(m.player2Name, m.player2Id, m.player2Archetype, m.player2DeckUrl)}
        </span>
        {m.date && <span style={{ color: "#999", fontSize: "0.85rem" }}>{m.date}</span>}
        <button onClick={onEdit} title="Edit match" style={{ border: "none", background: "none", cursor: "pointer", color: "#2563eb", fontSize: "0.85rem" }}>
          edit
        </button>
        <button onClick={onRemove} title="Delete match" style={{ border: "none", background: "none", cursor: "pointer", color: "#999" }}>
          ✕
        </button>
      </div>
      {m.notes && (
        <div style={{ marginTop: "0.3rem", color: "#666", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{m.notes}</div>
      )}
    </div>
  );
}
