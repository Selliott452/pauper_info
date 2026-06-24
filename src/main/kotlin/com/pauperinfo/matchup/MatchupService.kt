package com.pauperinfo.matchup

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

// A head-to-head win rate of [archetype] vs [opponent] from one data source.
// For "global" only the aggregate winRate + games are known (no W-L-D breakdown).
data class MatchupResult(
    val archetype: String,
    val opponent: String,
    val source: String,
    val games: Int,
    val wins: Int?,
    val losses: Int?,
    val draws: Int?,
    val winRate: Double?,
)

// Computes archetype-vs-archetype win rates. Read-only across the three schemas;
// owns no data of its own.
@Service
class MatchupService(@PersistenceContext private val entityManager: EntityManager) {

    fun matchup(archetype: String, opponent: String, source: String): MatchupResult = when (source) {
        "global" -> global(archetype, opponent)
        "tournament" -> tally(archetype, opponent, "tournament", tournamentRows(archetype, opponent))
        "casual" -> tally(archetype, opponent, "casual", casualRows(archetype, opponent))
        else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "source must be global, tournament, or casual")
    }

    // The scraped mtgdecks winrate matrix (directional: archetype's % vs opponent).
    private fun global(archetype: String, opponent: String): MatchupResult {
        val row = entityManager.createNativeQuery(
            "SELECT winrate, matches FROM metagame.archetype_matchup WHERE archetype = :a AND opponent = :b"
        ).setParameter("a", archetype).setParameter("b", opponent).resultList.firstOrNull() as Array<*>?
            ?: return MatchupResult(archetype, opponent, "global", 0, null, null, null, null)
        val winrate = (row[0] as Number).toInt()
        val matches = (row[1] as Number).toInt()
        return MatchupResult(archetype, opponent, "global", matches, null, null, null, winrate / 100.0)
    }

    @Suppress("UNCHECKED_CAST")
    private fun tournamentRows(archetype: String, opponent: String): List<Array<Any?>> =
        entityManager.createNativeQuery(
            """
            SELECT p1.archetype, p2.archetype, m.player1_wins, m.player2_wins, m.draws
            FROM tournament.match m
            JOIN tournament.player p1 ON p1.id = m.player1_id
            JOIN tournament.player p2 ON p2.id = m.player2_id
            WHERE m.reported = true AND m.player2_id IS NOT NULL
              AND ((lower(p1.archetype) = lower(:a) AND lower(p2.archetype) = lower(:b))
                OR (lower(p1.archetype) = lower(:b) AND lower(p2.archetype) = lower(:a)))
            """.trimIndent()
        ).setParameter("a", archetype).setParameter("b", opponent).resultList as List<Array<Any?>>

    @Suppress("UNCHECKED_CAST")
    private fun casualRows(archetype: String, opponent: String): List<Array<Any?>> =
        entityManager.createNativeQuery(
            """
            SELECT player1_archetype, player2_archetype, player1_wins, player2_wins, draws
            FROM casual.match
            WHERE (lower(player1_archetype) = lower(:a) AND lower(player2_archetype) = lower(:b))
               OR (lower(player1_archetype) = lower(:b) AND lower(player2_archetype) = lower(:a))
            """.trimIndent()
        ).setParameter("a", archetype).setParameter("b", opponent).resultList as List<Array<Any?>>

    // Tallies W-L-D from the perspective of [archetype] over rows of
    // (player1_archetype, player2_archetype, p1_wins, p2_wins, draws).
    private fun tally(archetype: String, opponent: String, source: String, rows: List<Array<Any?>>): MatchupResult {
        var wins = 0
        var losses = 0
        var draws = 0
        for (r in rows) {
            val a1 = r[0] as String
            val p1Wins = (r[2] as Number).toInt()
            val p2Wins = (r[3] as Number).toInt()
            // Which side is "my" archetype? (For a mirror, treat player 1 as mine.)
            val mineIsP1 = a1.equals(archetype, ignoreCase = true)
            val mine = if (mineIsP1) p1Wins else p2Wins
            val theirs = if (mineIsP1) p2Wins else p1Wins
            when {
                mine > theirs -> wins++
                mine < theirs -> losses++
                else -> draws++
            }
        }
        val games = wins + losses + draws
        val winRate = if (games == 0) null else Math.round(wins.toDouble() / games * 1000) / 1000.0
        return MatchupResult(archetype, opponent, source, games, wins, losses, draws, winRate)
    }
}
