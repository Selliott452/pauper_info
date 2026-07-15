package com.pauperinfo.casual

data class CreateCasualPlayerRequest(val name: String)

data class UpdateCasualPlayerRequest(val name: String)

// Create a match. Players are given by name and created on the fly if new.
data class CreateMatchRequest(
    val player1: String,
    val player2: String,
    val player1Wins: Int,
    val player2Wins: Int,
    val draws: Int? = null,
    val player1Archetype: String? = null,
    val player2Archetype: String? = null,
    val player1DeckUrl: String? = null,
    val player2DeckUrl: String? = null,
    val date: String? = null,
    val notes: String? = null,
)

data class CasualMatchView(
    val id: Int,
    val player1Id: Int,
    val player1Name: String,
    val player2Id: Int,
    val player2Name: String,
    val player1Wins: Int,
    val player2Wins: Int,
    val draws: Int,
    val player1Archetype: String?,
    val player2Archetype: String?,
    val player1DeckUrl: String?,
    val player2DeckUrl: String?,
    val date: String?,
    val notes: String?,
)

// Leaderboard line: a player's overall casual record.
data class CasualPlayerSummary(
    val id: Int,
    val name: String,
    val matches: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val matchWinPct: Double,
)

// Outcome of resolving a player identifier (id / slug / partial name) to a page.
// Exactly one of these is meaningful: playerId set => unique match (load that page);
// otherwise candidates holds the ambiguous matches to disambiguate between (empty => none).
data class CasualPlayerResolution(
    val playerId: Int?,
    val candidates: List<CasualPlayerSummary>,
)

// W-L-D bucketed by archetype (matches the frontend ArchetypeRecord shape).
data class RecordLine(val archetype: String?, val wins: Int, val losses: Int, val draws: Int)
data class OpponentLine(val opponentId: Int, val opponentName: String, val wins: Int, val losses: Int, val draws: Int)

data class CasualPlayerDetail(
    val id: Int,
    val name: String,
    val matches: Int,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val matchWinPct: Double,
    val gameWinPct: Double,
    val archetypesPlayed: List<RecordLine>,
    val vsPlayers: List<OpponentLine>,
    val vsArchetypes: List<RecordLine>,
    // Full match history, most recent first (the frontend paginates it).
    val matchHistory: List<CasualMatchView>,
)
