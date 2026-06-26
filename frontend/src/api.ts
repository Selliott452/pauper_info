// Base URL for the API. Empty in dev (same-origin via the Vite proxy); set to
// the Cloud Run URL at build time (VITE_API_BASE_URL) for the GitHub Pages build.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// --- Fetch helpers --------------------------------------------------------------
// Every endpoint goes through one of these so error handling, headers, and JSON
// parsing live in exactly one place.

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// GET that treats 404 as "no such resource" (null) rather than an error.
async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// POST/PUT/PATCH/DELETE that returns a JSON body. The server's response text (if
// any) is used as the error message, falling back to the status code.
async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || `API error ${res.status}`);
  return res.json();
}

// DELETE/action with no response body.
async function apiSendVoid(method: string, path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

type ParamValue = string | number | string[] | undefined | null;

// Builds a query string. Array values whose key is listed in `repeat` are sent as
// repeated params (so values containing commas, e.g. card names, survive); other
// arrays are comma-joined. Empty/nullish values are omitted.
function toParams(obj: Record<string, ParamValue>, repeat: string[] = []): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (repeat.includes(key)) for (const v of value) params.append(key, v);
      else params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

// --- Cards ----------------------------------------------------------------------

// Mirrors the Kotlin CardStatistics DTO returned by the Spring API.
export interface CardStatistics {
  id: string;
  name: string;
  colors: string[];
  mainboardDeckCount: number;
  sideboardDeckCount: number;
  avgMainboardQuantity: number | null;
  avgSideboardQuantity: number | null;
  avgTotalQuantity: number | null;
}

// Mirrors the Kotlin CardDetail DTO (card metadata + play stats).
export interface CardDetail {
  id: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  colors: string[];
  rarity: string;
  setCode: string;
  imageUri: string | null;
  backImageUri: string | null;
  mainboardDeckCount: number;
  sideboardDeckCount: number;
  avgMainboardQuantity: number | null;
  avgSideboardQuantity: number | null;
  avgTotalQuantity: number | null;
}

export interface CooccurringCard {
  id: string;
  name: string;
  colors: string[];
  deckCount: number;
}

export interface CardCooccurrence {
  cardName: string;
  deckCount: number;
  cooccurrences: CooccurringCard[];
}

export interface CardArchetype {
  archetype: string;
  inclusion: number;
}

// Calls GET /cards/{name}. Returns null on 404 (unknown card).
export function fetchCardDetail(name: string): Promise<CardDetail | null> {
  return apiGetOrNull(`/api/cards/${encodeURIComponent(name)}`);
}

// Calls GET /api/cards/{name}/cooccurrences.
export function fetchCooccurrences(name: string, limit = 50): Promise<CardCooccurrence | null> {
  return apiGetOrNull(`/api/cards/${encodeURIComponent(name)}/cooccurrences?limit=${limit}`);
}

// Archetypes a card belongs to (from the scraped profiles), most-central first.
export function fetchCardArchetypes(name: string): Promise<CardArchetype[]> {
  return apiGet(`/api/archetypes/by-card/${encodeURIComponent(name)}`);
}

// All card names, for autocomplete.
export function fetchCardNames(): Promise<string[]> {
  return apiGet(`/api/cards/names`);
}

// Matches the CardStatSort enum on the backend.
export type SortBy =
  | "NAME"
  | "MAINBOARD_DECK_COUNT"
  | "SIDEBOARD_DECK_COUNT"
  | "AVG_MAINBOARD_QUANTITY"
  | "AVG_SIDEBOARD_QUANTITY"
  | "AVG_TOTAL_QUANTITY";

export type SortDirection = "ASC" | "DESC";

export interface StatisticsQuery {
  colors?: string[];
  colorMatch?: "within" | "exact";
  names?: string[];
  types?: string[];
  minMainboardDecks?: number;
  minSideboardDecks?: number;
  sortBy?: SortBy;
  direction?: SortDirection;
  limit?: number;
  offset?: number;
}

// Builds the query string and calls GET /cards/statistics.
export function fetchCardStatistics(query: StatisticsQuery): Promise<CardStatistics[]> {
  const params = toParams({
    colors: query.colors,
    colorMatch: query.colorMatch,
    names: query.names,
    types: query.types,
    minMainboardDecks: query.minMainboardDecks,
    minSideboardDecks: query.minSideboardDecks,
    sortBy: query.sortBy,
    direction: query.direction,
    limit: query.limit,
    offset: query.offset,
  });
  return apiGet(`/api/cards/statistics?${params}`);
}

// --- Archetypes -----------------------------------------------------------------

export interface ArchetypeSummary {
  name: string;
  deckCount: number;
  colors: string[];
  overallWinrate: number | null;
  overallMatches: number | null;
}

export interface ArchetypeCardWeight {
  name: string;
  inclusion: number;
}

export interface ArchetypeMatchupWeight {
  opponent: string;
  winrate: number;
  matches: number;
}

export interface ArchetypeDetail {
  name: string;
  deckCount: number;
  colors: string[];
  overallWinrate: number | null;
  overallMatches: number | null;
  cards: ArchetypeCardWeight[];
  matchups: ArchetypeMatchupWeight[];
}

export interface ArchetypeScore {
  archetype: string;
  score: number;
}

export function fetchArchetypes(): Promise<ArchetypeSummary[]> {
  return apiGet(`/api/archetypes`);
}

export function fetchArchetype(name: string): Promise<ArchetypeDetail | null> {
  return apiGetOrNull(`/api/archetypes/${encodeURIComponent(name)}`);
}

// Ranked archetype scores for a deck (how it was classified + alternatives).
export function fetchDeckRank(deckId: string, limit = 6): Promise<ArchetypeScore[]> {
  return apiGet(`/api/archetypes/rank/${encodeURIComponent(deckId)}?limit=${limit}`);
}

// --- Decks ----------------------------------------------------------------------

export interface DeckSummary {
  id: string;
  name: string | null;
  author: string | null;
  colors: string[];
  archetype: string | null;
  archetypeConfidence: string | null;
}

export interface DeckCardEntry {
  cardId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
  colors: string[];
  imageUri: string | null;
  quantity: number;
}

export interface DeckDetail {
  id: string;
  name: string | null;
  author: string | null;
  colors: string[];
  createdAt: string | null;
  updatedAt: string | null;
  archetype: string | null;
  archetypeConfidence: string | null;
  mainboard: DeckCardEntry[];
  sideboard: DeckCardEntry[];
}

export interface DeckListQuery {
  colors?: string[];
  colorMatch?: "within" | "exact";
  author?: string;
  name?: string;
  archetypes?: string[];
  confidences?: string[];
  mainboardCards?: string[];
  sideboardCards?: string[];
  limit?: number;
  offset?: number;
}

// Repeated (vs comma-joined) multi-value deck filters.
const DECK_REPEAT = ["archetypes", "confidences", "mainboardCards", "sideboardCards"];

export function fetchDeck(id: string): Promise<DeckDetail | null> {
  return apiGetOrNull(`/api/decks/${encodeURIComponent(id)}`);
}

export function fetchDecks(query: DeckListQuery): Promise<DeckSummary[]> {
  const params = toParams(query as Record<string, ParamValue>, DECK_REPEAT);
  return apiGet(`/api/decks?${params}`);
}

export function fetchDecksCount(query: DeckListQuery): Promise<number> {
  const { limit: _l, offset: _o, ...filters } = query;
  const params = toParams(filters as Record<string, ParamValue>, DECK_REPEAT);
  return apiGet(`/api/decks/count?${params}`);
}

// A random deck matching optional filters, or null if none match.
export function fetchRandomDeck(query: {
  archetypes?: string[];
  confidences?: string[];
  updatedWithinDays?: number;
}): Promise<DeckSummary | null> {
  const params = toParams(query, ["archetypes", "confidences"]);
  return apiGetOrNull(`/api/decks/random?${params}`);
}

// --- Matchups -------------------------------------------------------------------

export interface MatchupResult {
  archetype: string;
  opponent: string;
  source: string;
  games: number;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  winRate: number | null;
}

// Win rate of one archetype vs another from a given source (global/tournament/casual).
export function fetchMatchup(archetype: string, opponent: string, source: string): Promise<MatchupResult> {
  const params = toParams({ archetype, opponent, source });
  return apiGet(`/api/matchups?${params}`);
}

// One archetype's slice of the recorded-tournament metagame.
export interface ArchetypeMetagameRow {
  archetype: string;
  players: number;
  share: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
}

// Archetype representation + match record across all recorded tournaments.
export function fetchTournamentMetagame(): Promise<ArchetypeMetagameRow[]> {
  return apiGet(`/api/matchups/tournament-metagame`);
}

// Same breakdown over recorded casual matches (representation by appearances).
export function fetchCasualMetagame(): Promise<ArchetypeMetagameRow[]> {
  return apiGet(`/api/matchups/casual-metagame`);
}

// --- Swiss tournament manager (separate from the metagame stats above) ----------

export interface TournamentSummary {
  id: number;
  name: string;
  date: string | null;
  status: string;
  playerCount: number;
  currentRound: number;
}

export interface PlayerStanding {
  rank: number;
  playerId: number;
  competitorId: number | null;
  name: string;
  archetype: string | null;
  deckUrl: string | null;
  dropped: boolean;
  matchPoints: number;
  wins: number;
  losses: number;
  draws: number;
  omwp: number;
  gwp: number;
  ogwp: number;
}

export interface MatchView {
  matchId: number;
  player1Id: number;
  player1Name: string;
  player2Id: number | null;
  player2Name: string | null;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  reported: boolean;
  bye: boolean;
}

export interface RoundView {
  id: number;
  number: number;
  matches: MatchView[];
  // Timer state: timerEndsAt (ISO) is set while running, timerRemainingSeconds
  // while paused; both null when the timer hasn't been started.
  timerEndsAt: string | null;
  timerRemainingSeconds: number | null;
}

export interface TournamentDetail {
  id: number;
  name: string;
  date: string | null;
  status: string;
  currentRound: number;
  roundMinutes: number | null;
  canPair: boolean;
  standings: PlayerStanding[];
  roundViews: RoundView[];
}

export function fetchTournaments(): Promise<TournamentSummary[]> {
  return apiGet(`/api/tournaments`);
}

export function fetchTournament(id: number): Promise<TournamentDetail> {
  return apiGet(`/api/tournaments/${id}`);
}

export function createTournament(body: { name: string; players: string[]; date?: string; roundMinutes?: number | null }) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments`, body);
}

export function updateTournament(id: number, body: { name: string; date: string | null; roundMinutes: number | null }) {
  return apiSend<TournamentDetail>("PATCH", `/api/tournaments/${id}`, body);
}

export type TimerAction = "start" | "pause" | "resume" | "reset";

export function roundTimer(id: number, roundId: number, action: TimerAction) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/rounds/${roundId}/timer/${action}`);
}

export function pairRound(id: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/pair`);
}

export function completeTournament(id: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/complete`);
}

export function reopenTournament(id: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/reopen`);
}

export function addRound(id: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/rounds`);
}

export function addMatch(id: number, roundId: number, body: { player1Id: number; player2Id: number | null }) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/rounds/${roundId}/matches`, body);
}

export function deleteMatch(id: number, matchId: number) {
  return apiSend<TournamentDetail>("DELETE", `/api/tournaments/${id}/matches/${matchId}`);
}

export function deleteRound(id: number, roundId: number) {
  return apiSend<TournamentDetail>("DELETE", `/api/tournaments/${id}/rounds/${roundId}`);
}

export function reportResult(
  id: number,
  matchId: number,
  body: { player1Wins: number; player2Wins: number; draws: number },
) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/matches/${matchId}`, body);
}

export function dropPlayer(id: number, playerId: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/players/${playerId}/drop`);
}

export function rejoinPlayer(id: number, playerId: number) {
  return apiSend<TournamentDetail>("POST", `/api/tournaments/${id}/players/${playerId}/rejoin`);
}

export function updatePlayer(
  id: number,
  playerId: number,
  body: { archetype: string | null; deckUrl: string | null },
) {
  return apiSend<TournamentDetail>("PATCH", `/api/tournaments/${id}/players/${playerId}`, body);
}

export function deleteTournament(id: number): Promise<void> {
  return apiSendVoid("DELETE", `/api/tournaments/${id}`);
}

// --- Competitors (persistent players tracked across tournaments) ----------------

export interface CompetitorSummary {
  id: number;
  name: string;
  events: number;
  wins: number;
  losses: number;
  draws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  matchWinPct: number;
  gameWinPct: number;
}

export interface CompetitorEventResult {
  eventId: number;
  eventName: string;
  rank: number;
  players: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface ArchetypeRecord {
  archetype: string | null;
  wins: number;
  losses: number;
  draws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
}

export interface OpponentRecord {
  opponentId: number | null;
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
}

export interface CompetitorDetail {
  id: number;
  name: string;
  events: number;
  wins: number;
  losses: number;
  draws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  matchWinPct: number;
  gameWinPct: number;
  results: CompetitorEventResult[];
  archetypesPlayed: ArchetypeRecord[];
  vsPlayers: OpponentRecord[];
  vsArchetypes: ArchetypeRecord[];
}

export function fetchCompetitors(): Promise<CompetitorSummary[]> {
  return apiGet(`/api/competitors`);
}

export function fetchCompetitor(id: number): Promise<CompetitorDetail> {
  return apiGet(`/api/competitors/${id}`);
}

export function createCompetitor(name: string): Promise<CompetitorSummary> {
  return apiSend("POST", `/api/competitors`, { name });
}

// --- Casual 1-on-1 matches (separate from tournaments and metagame) -------------

export interface CasualMatchView {
  id: number;
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  player1Archetype: string | null;
  player2Archetype: string | null;
  player1DeckUrl: string | null;
  player2DeckUrl: string | null;
  date: string | null;
}

export interface CasualPlayerSummary {
  id: number;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
}

export interface CasualPlayerDetail {
  id: number;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  gameWinPct: number;
  archetypesPlayed: ArchetypeRecord[];
  vsPlayers: OpponentRecord[];
  vsArchetypes: ArchetypeRecord[];
  recentMatches: CasualMatchView[];
}

export interface CreateCasualMatch {
  player1: string;
  player2: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  player1Archetype?: string | null;
  player2Archetype?: string | null;
  player1DeckUrl?: string | null;
  player2DeckUrl?: string | null;
  date?: string | null;
}

export function fetchCasualLeaderboard(): Promise<CasualPlayerSummary[]> {
  return apiGet(`/api/casual/players`);
}

export function createCasualPlayer(name: string): Promise<CasualPlayerSummary> {
  return apiSend("POST", `/api/casual/players`, { name });
}

export function fetchCasualPlayerNames(): Promise<string[]> {
  return apiGet(`/api/casual/players/names`);
}

export function fetchCasualPlayer(id: number): Promise<CasualPlayerDetail> {
  return apiGet(`/api/casual/players/${id}`);
}

export function fetchCasualMatches(): Promise<CasualMatchView[]> {
  return apiGet(`/api/casual/matches`);
}

export function createCasualMatch(body: CreateCasualMatch): Promise<CasualMatchView> {
  return apiSend("POST", `/api/casual/matches`, body);
}

export function updateCasualMatch(id: number, body: CreateCasualMatch): Promise<CasualMatchView> {
  return apiSend("PUT", `/api/casual/matches/${id}`, body);
}

export function deleteCasualMatch(id: number): Promise<void> {
  return apiSendVoid("DELETE", `/api/casual/matches/${id}`);
}
