import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackLink } from "./BackLink";
import { ComboBox } from "./ComboBox";
import { Modal } from "./Modal";
import { Loading, ErrorText } from "./QueryState";
import { RenameModal } from "./RenameModal";
import { pct } from "./format";
import { useConfirm } from "./useConfirm";
import { downloadJson, slugify } from "./download";
import {
  addMatch,
  addPlayer,
  addRound,
  completeTournament,
  deleteMatch,
  deleteRound,
  deleteTournament,
  dropPlayer,
  fetchCompetitors,
  fetchTournament,
  fetchArchetypes,
  pairRound,
  rejoinPlayer,
  removePlayer,
  renameCompetitor,
  reopenTournament,
  reportResult,
  roundTimer,
  updatePlayer,
  updateTournament,
  type MatchView,
  type PlayerStanding,
  type RoundView,
  type TimerAction,
  type TournamentDetail,
} from "./api";

type PlayerOption = { id: number; name: string };

export function TournamentPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Poll so changes made in another window/device (timer pause/resume, results,
  // pairings) show up here within a few seconds.
  const { data, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => fetchTournament(id),
    refetchInterval: 3000,
  });
  const { data: archetypeList } = useQuery({ queryKey: ["archetypes"], queryFn: fetchArchetypes, staleTime: Infinity });
  const archetypeNames = archetypeList?.map((a) => a.name) ?? [];
  const { data: competitors } = useQuery({ queryKey: ["competitors"], queryFn: fetchCompetitors });
  const competitorNames = competitors?.map((c) => c.name) ?? [];

  // Mutations return the updated tournament; write it straight into the cache.
  const setData = (d: TournamentDetail) => queryClient.setQueryData(["tournament", id], d);

  const pair = useMutation({ mutationFn: () => pairRound(id), onSuccess: setData });
  const report = useMutation({
    mutationFn: (v: { matchId: number; p1: number; p2: number; draws: number }) =>
      reportResult(id, v.matchId, { player1Wins: v.p1, player2Wins: v.p2, draws: v.draws }),
    onSuccess: setData,
  });
  const drop = useMutation({ mutationFn: (playerId: number) => dropPlayer(id, playerId), onSuccess: setData });
  const rejoin = useMutation({ mutationFn: (playerId: number) => rejoinPlayer(id, playerId), onSuccess: setData });
  const addPlayerM = useMutation({ mutationFn: (name: string) => addPlayer(id, name), onSuccess: setData });
  const removePlayerM = useMutation({ mutationFn: (playerId: number) => removePlayer(id, playerId), onSuccess: setData });
  const renamePlayerM = useMutation({
    mutationFn: (v: { competitorId: number; name: string }) => renameCompetitor(v.competitorId, v.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament", id] });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      queryClient.invalidateQueries({ queryKey: ["competitor"] });
    },
  });
  const newRound = useMutation({ mutationFn: () => addRound(id), onSuccess: setData });
  const addPairing = useMutation({
    mutationFn: (v: { roundId: number; player1Id: number; player2Id: number | null }) =>
      addMatch(id, v.roundId, { player1Id: v.player1Id, player2Id: v.player2Id }),
    onSuccess: setData,
  });
  const removeMatch = useMutation({ mutationFn: (matchId: number) => deleteMatch(id, matchId), onSuccess: setData });
  const timer = useMutation({
    mutationFn: (v: { roundId: number; action: TimerAction }) => roundTimer(id, v.roundId, v.action),
    onSuccess: setData,
  });
  const removeRound = useMutation({ mutationFn: (roundId: number) => deleteRound(id, roundId), onSuccess: setData });
  const updateDeck = useMutation({
    mutationFn: (v: { playerId: number; archetype: string | null; deckUrl: string | null }) =>
      updatePlayer(id, v.playerId, { archetype: v.archetype, deckUrl: v.deckUrl }),
    onSuccess: setData,
  });
  const complete = useMutation({ mutationFn: () => completeTournament(id), onSuccess: setData });
  const reopen = useMutation({ mutationFn: () => reopenTournament(id), onSuccess: setData });
  const remove = useMutation({
    mutationFn: () => deleteTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate("/tournaments");
    },
  });
  const confirmDelete = useConfirm(() => remove.mutate(), {
    title: "Delete tournament?",
    message: "This permanently deletes the tournament along with all its rounds and results.",
    confirmLabel: "Delete tournament",
  });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editRoundMinutes, setEditRoundMinutes] = useState("");
  const update = useMutation({
    mutationFn: () =>
      updateTournament(id, {
        name: editName,
        date: editDate || null,
        roundMinutes: editRoundMinutes ? Number(editRoundMinutes) : null,
      }),
    onSuccess: (d) => {
      setData(d);
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <main className="page">
        <BackLink />
        <Loading />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page">
        <BackLink />
        <p>Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <BackLink />

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: "0.5rem 0" }}>{data.name}</h1>
        <span style={{ color: "#666" }}>
          {data.date ? `${data.date} · ` : ""}
          {data.status} · {data.currentRound} round{data.currentRound === 1 ? "" : "s"}
          {data.roundMinutes ? ` · ${data.roundMinutes} min rounds` : ""}
        </span>
        <button
          className="pill"
          onClick={() => {
            setEditName(data.name);
            setEditDate(data.date ?? "");
            setEditRoundMinutes(data.roundMinutes ? String(data.roundMinutes) : "");
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>

      {editing && (
        <EditTournamentModal
          name={editName}
          date={editDate}
          roundMinutes={editRoundMinutes}
          onNameChange={setEditName}
          onDateChange={setEditDate}
          onRoundMinutesChange={setEditRoundMinutes}
          onSave={() => update.mutate()}
          saving={update.isPending}
          saveError={update.isError ? (update.error as Error).message : null}
          onClose={() => setEditing(false)}
          players={data.standings}
          competitorNames={competitorNames}
          onAddPlayer={(name) => addPlayerM.mutate(name)}
          addingPlayer={addPlayerM.isPending}
          addPlayerError={addPlayerM.isError ? (addPlayerM.error as Error).message : null}
          onRemovePlayer={(playerId) => removePlayerM.mutate(playerId)}
          onRenamePlayer={(competitorId, name) => renamePlayerM.mutate({ competitorId, name })}
          renamingPlayer={renamePlayerM.isPending}
          renamePlayerError={renamePlayerM.isError ? (renamePlayerM.error as Error).message : null}
        />
      )}

      {data.status === "COMPLETE" && data.standings.length > 0 && (
        <div
          style={{
            background: "#fef9c3",
            border: "1px solid #fde047",
            borderRadius: 8,
            padding: "0.6rem 1rem",
            margin: "0.75rem 0",
            fontSize: "1.05rem",
          }}
        >
          Winner:{" "}
          {data.standings[0].competitorId != null ? (
            <Link to={`/tournaments/players/${data.standings[0].competitorId}`}>
              <strong>{data.standings[0].name}</strong>
            </Link>
          ) : (
            <strong>{data.standings[0].name}</strong>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0 1.5rem", flexWrap: "wrap" }}>
        <button
          className="pill active"
          disabled={!data.canPair || pair.isPending}
          onClick={() => pair.mutate()}
          style={{ opacity: data.canPair ? 1 : 0.5 }}
        >
          {data.currentRound === 0 ? "Start round 1" : "Pair next round"}
        </button>
        {data.status !== "COMPLETE" && (
          <button className="pill" disabled={newRound.isPending} onClick={() => newRound.mutate()}>
            Add round (manual)
          </button>
        )}
        {data.status === "COMPLETE" ? (
          <button className="pill" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
            Reopen
          </button>
        ) : (
          <button className="pill" disabled={complete.isPending} onClick={() => complete.mutate()}>
            Mark complete
          </button>
        )}
        <button
          className="pill push-end"
          onClick={() => downloadJson(`tournament-${slugify(data.name)}`, data)}
        >
          Export JSON
        </button>
        <button className="pill" disabled={remove.isPending} onClick={confirmDelete.onClick}>
          Delete tournament
        </button>
      </div>
      {confirmDelete.dialog}
      {pair.isError && <ErrorText message={(pair.error as Error).message} />}
      {remove.isError && <ErrorText message={(remove.error as Error).message} />}

      <datalist id="tourney-archetypes">
        {archetypeNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <h2 style={{ marginBottom: "0.25rem" }}>Standings</h2>
      <p style={{ color: "#666", fontSize: "0.85rem", marginTop: 0 }}>
        Ranked by match points, then "strength of schedule" tiebreakers - how well the
        players each person has faced have done, their own game win %, then
        their opponents' game win %.
      </p>
      <table className="data-table" style={{ marginBottom: "2rem" }}>
        <thead>
          <tr>
            {(
              [
                { label: "#", title: "Rank" },
                { label: "Player", title: "Player" },
                { label: "Points", title: "Match points: win = 3, draw = 1, loss = 0" },
                { label: "Record", title: "Match wins–losses–draws" },
                { label: "Opp. win %", title: "Combined win rate of all the opponents this player has faced across the rounds - rewards a tougher schedule (first tiebreaker)" },
                { label: "Game win %", title: "Share of individual games this player has won" },
                { label: "Opp. game win %", title: "Combined game win rate of all the opponents this player has faced" },
                { label: "", title: "" },
              ] as const
            ).map((h, i) => (
              <th key={h.label + i} title={h.title} style={{ textAlign: i === 1 ? "left" : i === 7 ? "right" : "center" }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.standings.map((s) => (
            <StandingRow
              key={s.playerId}
              standing={s}
              complete={data.status === "COMPLETE"}
              onSaveDeck={(archetype, deckUrl) => updateDeck.mutate({ playerId: s.playerId, archetype, deckUrl })}
              onDrop={() => drop.mutate(s.playerId)}
              onRejoin={() => rejoin.mutate(s.playerId)}
            />
          ))}
        </tbody>
      </table>

      {[...data.roundViews].reverse().map((round) => (
        <RoundBlock
          key={round.id}
          round={round}
          tournamentId={id}
          locked={data.status === "COMPLETE"}
          roundMinutes={data.roundMinutes}
          players={data.standings.map((s) => ({ id: s.playerId, name: s.name }))}
          onReport={(matchId, p1, p2, draws) => report.mutate({ matchId, p1, p2, draws })}
          onRemove={(matchId) => removeMatch.mutate(matchId)}
          onAddPairing={(player1Id, player2Id) => addPairing.mutate({ roundId: round.id, player1Id, player2Id })}
          onDeleteRound={() => removeRound.mutate(round.id)}
          onTimer={(action) => timer.mutate({ roundId: round.id, action })}
        />
      ))}
    </main>
  );
}

// Dialog for the tournament's name/date/round length plus its player roster.
// Adding resolves/creates a competitor by name (same as tournament creation);
// removing hard-deletes the player and any matches they're already in, unlike
// Drop (which freezes their record so it survives in standings/history).
function EditTournamentModal({
  name,
  date,
  roundMinutes,
  onNameChange,
  onDateChange,
  onRoundMinutesChange,
  onSave,
  saving,
  saveError,
  onClose,
  players,
  competitorNames,
  onAddPlayer,
  addingPlayer,
  addPlayerError,
  onRemovePlayer,
  onRenamePlayer,
  renamingPlayer,
  renamePlayerError,
}: {
  name: string;
  date: string;
  roundMinutes: string;
  onNameChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onRoundMinutesChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  players: PlayerStanding[];
  competitorNames: string[];
  onAddPlayer: (name: string) => void;
  addingPlayer: boolean;
  addPlayerError: string | null;
  onRemovePlayer: (playerId: number) => void;
  onRenamePlayer: (competitorId: number, name: string) => void;
  renamingPlayer: boolean;
  renamePlayerError: string | null;
}) {
  const [newPlayer, setNewPlayer] = useState("");

  const label = { display: "block", fontSize: "0.85rem", color: "#555", marginBottom: "1rem" } as const;
  const input = { display: "block", width: "100%", marginTop: "0.25rem", boxSizing: "border-box" as const };

  function addPlayer() {
    const trimmed = newPlayer.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setNewPlayer("");
  }

  return (
    <Modal width={440} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>Edit tournament</h3>
      <label style={label}>
        Name
        <input
          type="text"
          className="text-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Tournament name"
          style={input}
        />
      </label>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <label style={{ ...label, flex: 1 }}>
          Date
          <input type="date" className="text-input" value={date} onChange={(e) => onDateChange(e.target.value)} style={input} />
        </label>
        <label style={{ ...label, flex: 1 }}>
          Round length (mins)
          <input
            type="number"
            min={0}
            className="text-input"
            value={roundMinutes}
            onChange={(e) => onRoundMinutesChange(e.target.value)}
            placeholder="none"
            style={input}
          />
        </label>
      </div>
      {saveError && <ErrorText message={saveError} />}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button className="pill active" disabled={!name.trim() || saving} onClick={onSave}>
          Save
        </button>
      </div>

      <h4 style={{ margin: "0 0 0.5rem" }}>Players</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
        {players.map((p) => (
          <PlayerRow
            key={p.playerId}
            player={p}
            onRemove={() => onRemovePlayer(p.playerId)}
            onRename={p.competitorId != null ? (name) => onRenamePlayer(p.competitorId!, name) : undefined}
            renaming={renamingPlayer}
            renameError={renamePlayerError}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ComboBox
          value={newPlayer}
          onChange={setNewPlayer}
          options={competitorNames}
          placeholder="Add a player…"
          block
        />
        <button className="pill" disabled={!newPlayer.trim() || addingPlayer} onClick={addPlayer}>
          Add
        </button>
      </div>
      {addPlayerError && <ErrorText message={addPlayerError} />}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
        <button className="pill" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// One roster row in the edit dialog, with its own remove-confirmation and,
// when the player is linked to a competitor, a rename action. Renaming here
// renames their persistent competitor identity, so it applies everywhere they've
// played, not just this tournament.
function PlayerRow({
  player,
  onRemove,
  onRename,
  renaming,
  renameError,
}: {
  player: PlayerStanding;
  onRemove: () => void;
  onRename?: (name: string) => void;
  renaming: boolean;
  renameError: string | null;
}) {
  const [showRename, setShowRename] = useState(false);
  const confirmRemove = useConfirm(onRemove, {
    title: `Remove ${player.name}?`,
    message: "This deletes them from the tournament along with any matches they've already played. Use Drop instead to keep their record but stop pairing them.",
    confirmLabel: "Remove player",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.3rem 0.5rem", border: "1px solid #ececec", borderRadius: 6 }}>
      <span>
        {player.name}
        {player.dropped && <span style={{ color: "#999", fontSize: "0.8rem" }}> (dropped)</span>}
      </span>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {onRename && (
          <button className="pill" onClick={() => setShowRename(true)}>
            Update Name
          </button>
        )}
        <button className="pill" onClick={confirmRemove.onClick}>
          Remove
        </button>
      </div>
      {confirmRemove.dialog}
      {showRename && onRename && (
        <RenameModal
          title="Update name"
          initial={player.name}
          saving={renaming}
          error={renameError}
          onSave={(name) => {
            onRename(name);
            setShowRename(false);
          }}
          onClose={() => setShowRename(false)}
        />
      )}
    </div>
  );
}

function RoundBlock({
  round,
  tournamentId,
  locked,
  roundMinutes,
  players,
  onReport,
  onRemove,
  onAddPairing,
  onDeleteRound,
  onTimer,
}: {
  round: RoundView;
  tournamentId: number;
  locked: boolean;
  roundMinutes: number | null;
  players: PlayerOption[];
  onReport: (matchId: number, p1: number, p2: number, draws: number) => void;
  onRemove: (matchId: number) => void;
  onAddPairing: (player1Id: number, player2Id: number | null) => void;
  onDeleteRound: () => void;
  onTimer: (action: TimerAction) => void;
}) {
  const confirmDelete = useConfirm(onDeleteRound, {
    title: `Delete round ${round.number}?`,
    message: "This removes the round and any results recorded in it.",
    confirmLabel: "Delete round",
  });

  // Players already paired this round can't be added again.
  const paired = new Set<number>();
  for (const m of round.matches) {
    paired.add(m.player1Id);
    if (m.player2Id != null) paired.add(m.player2Id);
  }
  const available = players.filter((p) => !paired.has(p.id));

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Round {round.number}</h2>
        <Link className="pill" to={`/tournaments/${tournamentId}/round/${round.number}`}>
          Round View
        </Link>
        {!locked && (
          <button className="pill" onClick={confirmDelete.onClick}>
            Delete round
          </button>
        )}
        {confirmDelete.dialog}
        {!locked && roundMinutes != null && <RoundTimer round={round} roundMinutes={roundMinutes} onTimer={onTimer} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {[...round.matches]
          .sort((a, b) => Number(a.bye) - Number(b.bye))
          .map((m) => (
          <MatchRow
            key={m.matchId}
            match={m}
            locked={locked}
            onReport={(p1, p2, draws) => onReport(m.matchId, p1, p2, draws)}
            onRemove={() => onRemove(m.matchId)}
          />
        ))}
        {!locked && available.length > 0 && <AddPairing players={available} onAdd={onAddPairing} />}
      </div>
    </div>
  );
}

// A live round timer. Server state is the source of truth: while running the
// round carries timerEndsAt (a wall-clock instant) and we tick locally toward it;
// while paused it carries timerRemainingSeconds (a frozen value).
function RoundTimer({
  round,
  roundMinutes,
  onTimer,
}: {
  round: RoundView;
  roundMinutes: number;
  onTimer: (action: TimerAction) => void;
}) {
  const running = round.timerEndsAt != null;
  const paused = round.timerRemainingSeconds != null;

  // Re-render every second while running so the countdown advances.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  let seconds: number;
  if (running) seconds = Math.max(0, Math.round((Date.parse(round.timerEndsAt!) - Date.now()) / 1000));
  else if (paused) seconds = round.timerRemainingSeconds!;
  else seconds = roundMinutes * 60;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const expired = running && seconds === 0;
  const color = expired ? "#dc2626" : running ? "#16a34a" : "#444";

  return (
    <div className="push-end" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, fontSize: "1.1rem", color, minWidth: "3.5ch" }}>
        {expired ? "Time!" : `${mm}:${ss}`}
      </span>
      {!running && !paused && (
        <button className="pill" onClick={() => onTimer("start")}>
          Start
        </button>
      )}
      {running && (
        <button className="pill" onClick={() => onTimer("pause")}>
          Pause
        </button>
      )}
      {paused && (
        <button className="pill" onClick={() => onTimer("resume")}>
          Resume
        </button>
      )}
      {(running || paused) && (
        <button className="pill" onClick={() => onTimer("reset")}>
          Reset
        </button>
      )}
    </div>
  );
}

function AddPairing({
  players,
  onAdd,
}: {
  players: PlayerOption[];
  onAdd: (player1Id: number, player2Id: number | null) => void;
}) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("bye");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
        padding: "0.5rem 0.75rem",
        border: "1px dashed #d4d4d8",
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: "0.85rem", color: "#666" }}>Add pairing:</span>
      <select className="text-input" value={p1} onChange={(e) => setP1(e.target.value)}>
        <option value="">Player 1…</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span>vs</span>
      <select className="text-input" value={p2} onChange={(e) => setP2(e.target.value)}>
        <option value="bye">- bye -</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        className="pill"
        disabled={!p1 || p1 === p2}
        onClick={() => {
          onAdd(Number(p1), p2 === "bye" ? null : Number(p2));
          setP1("");
          setP2("bye");
        }}
      >
        Add
      </button>
    </div>
  );
}

function MatchRow({
  match,
  locked,
  onReport,
  onRemove,
}: {
  match: MatchView;
  locked: boolean;
  onReport: (p1: number, p2: number, draws: number) => void;
  onRemove: () => void;
}) {
  if (match.bye) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.75rem",
          border: "1px solid #ececec",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <span>
          <strong>{match.player1Name}</strong> - bye
        </span>
        {!locked && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }

  // Locked (tournament complete): show the final result read-only.
  if (locked) {
    const score = `${match.player1Wins}-${match.player2Wins}${match.draws ? `-${match.draws}` : ""}`;
    return (
      <div style={{ padding: "0.5rem 0.75rem", border: "1px solid #ececec", borderRadius: 8, background: "#fafafa" }}>
        <strong>{match.player1Name}</strong> vs <strong>{match.player2Name}</strong>
        {match.reported && <span style={{ marginLeft: 8, color: "#555" }}>{score}</span>}
      </div>
    );
  }

  return <ResultEntry match={match} onReport={onReport} onRemove={onRemove} />;
}

// One standings row. The deck/archetype editor lives here so the "Deck" button
// can sit in the actions column (with Drop) while the inputs/display sit under
// the player's name.
function StandingRow({
  standing: s,
  complete,
  onSaveDeck,
  onDrop,
  onRejoin,
}: {
  standing: PlayerStanding;
  complete: boolean;
  onSaveDeck: (archetype: string | null, deckUrl: string | null) => void;
  onDrop: () => void;
  onRejoin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const confirmDrop = useConfirm(onDrop, {
    title: `Drop ${s.name}?`,
    message: "They won't be paired in future rounds. You can rejoin them later.",
    confirmLabel: "Drop player",
  });

  const td = { padding: "0.4rem", borderBottom: "1px solid #eee" } as const;
  const center = { ...td, textAlign: "center" as const };

  return (
    <tr style={{ opacity: s.dropped ? 0.5 : 1 }}>
      <td style={center} data-label="Rank">{s.rank}</td>
      <td style={td} data-label="Player">
        {s.competitorId != null ? <Link to={`/tournaments/players/${s.competitorId}`}>{s.name}</Link> : s.name}
        {s.dropped && <span style={{ color: "#999", fontSize: "0.8rem" }}> (dropped)</span>}
        {(s.archetype || s.deckUrl) && (
          <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.15rem" }}>
            {s.archetype}
            {s.deckUrl && (
              <a href={s.deckUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>
                list ↗
              </a>
            )}
          </div>
        )}
      </td>
      <td style={{ ...center, fontWeight: 600 }} data-label="Points">{s.matchPoints}</td>
      <td style={center} data-label="Record">
        {s.wins}-{s.losses}-{s.draws}
      </td>
      <td style={center} data-label="Opp. win %">{pct(s.omwp)}</td>
      <td style={center} data-label="Game win %">{pct(s.gwp)}</td>
      <td style={center} data-label="Opp. game win %">{pct(s.ogwp)}</td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }} data-label="">
        <button className="pill" onClick={() => setEditing(true)}>
          Deck
        </button>
        {!complete &&
          (s.dropped ? (
            <button className="pill" style={{ marginLeft: 6 }} onClick={onRejoin}>
              Rejoin
            </button>
          ) : (
            <button className="pill" style={{ marginLeft: 6 }} onClick={confirmDrop.onClick}>
              Drop
            </button>
          ))}
        {confirmDrop.dialog}
      </td>
      {editing && (
        <DeckModal
          playerName={s.name}
          archetype={s.archetype ?? ""}
          deckUrl={s.deckUrl ?? ""}
          onClose={() => setEditing(false)}
          onSave={(a, u) => {
            onSaveDeck(a, u);
            setEditing(false);
          }}
        />
      )}
    </tr>
  );
}

// Modal for entering a player's deck details.
function DeckModal({
  playerName,
  archetype,
  deckUrl,
  onSave,
  onClose,
}: {
  playerName: string;
  archetype: string;
  deckUrl: string;
  onSave: (archetype: string | null, deckUrl: string | null) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState(archetype);
  const [u, setU] = useState(deckUrl);

  const label = { display: "block", fontSize: "0.85rem", color: "#555", marginBottom: "1rem" } as const;
  const input = { display: "block", width: "100%", marginTop: "0.25rem", boxSizing: "border-box" as const };

  return (
    <Modal width={380} onClose={onClose}>
        <h3 style={{ marginTop: 0 }}>{playerName} - deck</h3>
        <label style={label}>
          Archetype
          <input
            className="text-input"
            list="tourney-archetypes"
            placeholder="e.g. Mono Blue Terror"
            value={a}
            onChange={(e) => setA(e.target.value)}
            style={input}
          />
        </label>
        <label style={label}>
          Deck link
          <input
            className="text-input"
            placeholder="https://moxfield.com/decks/…"
            value={u}
            onChange={(e) => setU(e.target.value)}
            style={input}
          />
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="pill" onClick={onClose}>
            Cancel
          </button>
          <button className="pill active" onClick={() => onSave(a.trim() || null, u.trim() || null)}>
            Save
          </button>
        </div>
    </Modal>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      title="Remove pairing"
      style={{ border: "none", background: "none", cursor: "pointer", color: "#999", fontSize: "1rem" }}
    >
      ✕
    </button>
  );
}

function ResultEntry({
  match,
  onReport,
  onRemove,
}: {
  match: MatchView;
  onReport: (p1: number, p2: number, draws: number) => void;
  onRemove: () => void;
}) {
  // Fields start blank; a reported match prefills its stored result so it can be seen/edited.
  const [p1, setP1] = useState(match.reported ? String(match.player1Wins) : "");
  const [p2, setP2] = useState(match.reported ? String(match.player2Wins) : "");
  const [draws, setDraws] = useState(match.reported ? String(match.draws) : "");

  // Auto-save shortly after the user stops typing - but only once both win fields
  // are filled (draws are optional and default to 0), and only when the result
  // differs from what's stored (so mounting a match never reports a phantom result).
  useEffect(() => {
    if (p1.trim() === "" || p2.trim() === "") return;
    const n1 = Number(p1);
    const n2 = Number(p2);
    const nd = draws.trim() === "" ? 0 : Number(draws);
    if ([n1, n2, nd].some((n) => Number.isNaN(n))) return;
    if (match.reported && n1 === match.player1Wins && n2 === match.player2Wins && nd === match.draws) return;
    const t = setTimeout(() => onReport(n1, n2, nd), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1, p2, draws]);

  const numInput = {
    width: 44,
    padding: "0.3rem 0.4rem",
    textAlign: "center" as const,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "0.5rem 0.75rem",
        border: "1px solid #ececec",
        borderRadius: 8,
        background: match.reported ? "#f3fbf5" : "#fff",
      }}
    >
      <div style={{ flex: "1 1 220px" }}>
        <strong>{match.player1Name}</strong> vs <strong>{match.player2Name}</strong>
        {match.reported && <span style={{ marginLeft: 8, color: "#16a34a" }}>reported</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.8rem", color: "#666" }}>
          {match.player1Name} wins{" "}
          <input className="text-input" style={numInput} type="number" min={0} placeholder="–" value={p1} onChange={(e) => setP1(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.8rem", color: "#666" }}>
          {match.player2Name} wins{" "}
          <input className="text-input" style={numInput} type="number" min={0} placeholder="–" value={p2} onChange={(e) => setP2(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.8rem", color: "#666" }}>
          draws{" "}
          <input className="text-input" style={numInput} type="number" min={0} placeholder="–" value={draws} onChange={(e) => setDraws(e.target.value)} />
        </label>
        <RemoveButton onRemove={onRemove} />
      </div>
    </div>
  );
}
