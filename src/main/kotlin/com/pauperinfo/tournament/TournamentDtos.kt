package com.pauperinfo.tournament

data class CreateCompetitorRequest(val name: String)

// A competitor's career totals across every tournament they've played.
data class CompetitorSummary(
    val id: Int,
    val name: String,
    val events: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val matchWinPct: Double,
    val gameWinPct: Double,
)

// How a competitor finished one tournament.
data class CompetitorEventResult(
    val eventId: Int,
    val eventName: String,
    val rank: Int,
    val players: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
)

// A match-record breakdown (wins/losses/draws) bucketed by some key.
data class ArchetypeRecord(val archetype: String?, val wins: Int, val losses: Int, val draws: Int)
data class OpponentRecord(val opponentId: Int?, val opponentName: String, val wins: Int, val losses: Int, val draws: Int)

data class CompetitorDetail(
    val id: Int,
    val name: String,
    val events: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val matchWinPct: Double,
    val gameWinPct: Double,
    val results: List<CompetitorEventResult>,
    // Decks they've run, and head-to-head records vs opponents and vs archetypes.
    val archetypesPlayed: List<ArchetypeRecord>,
    val vsPlayers: List<OpponentRecord>,
    val vsArchetypes: List<ArchetypeRecord>,
)

// Request to create a tournament: a name, the player names, and optionally a fixed
// number of rounds (defaults to the Swiss recommendation for the player count).
data class CreateTournamentRequest(
    val name: String,
    val players: List<String>,
    // ISO date (yyyy-MM-dd) the tournament was/will be played, optional.
    val date: String? = null,
)

// Edit a tournament's name and/or date. A blank date clears it.
data class UpdateTournamentRequest(
    val name: String,
    val date: String? = null,
)

// Manually add a pairing to a round. player2Id null creates a bye for player1.
data class AddMatchRequest(
    val player1Id: Int,
    val player2Id: Int? = null,
)

data class ReportResultRequest(
    val player1Wins: Int,
    val player2Wins: Int,
    val draws: Int = 0,
)

data class TournamentSummary(
    val id: Int,
    val name: String,
    val date: String?,
    val status: String,
    val playerCount: Int,
    // Number of rounds run so far.
    val currentRound: Int,
)

// A player's line in the standings, with the standard MTG tiebreakers as percents.
// Set what a player ran in this event. Blank values clear the field.
data class UpdatePlayerRequest(
    val archetype: String? = null,
    val deckUrl: String? = null,
)

data class PlayerStanding(
    val rank: Int,
    val playerId: Int,
    // The persistent competitor this player is, for linking to their career page.
    val competitorId: Int?,
    val name: String,
    val archetype: String?,
    val deckUrl: String?,
    val dropped: Boolean,
    val matchPoints: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val omwp: Double,
    val gwp: Double,
    val ogwp: Double,
)

data class MatchView(
    val matchId: Int,
    val player1Id: Int,
    val player1Name: String,
    val player2Id: Int?,
    val player2Name: String?,
    val player1Wins: Int,
    val player2Wins: Int,
    val draws: Int,
    val reported: Boolean,
    val bye: Boolean,
)

data class RoundView(
    val id: Int,
    val number: Int,
    val matches: List<MatchView>,
)

data class TournamentDetail(
    val id: Int,
    val name: String,
    val date: String?,
    val status: String,
    val currentRound: Int,
    // True when the next round can be paired (active and all current results in).
    val canPair: Boolean,
    val standings: List<PlayerStanding>,
    val roundViews: List<RoundView>,
)
