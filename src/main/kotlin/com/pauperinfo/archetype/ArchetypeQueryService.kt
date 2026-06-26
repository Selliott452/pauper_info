package com.pauperinfo.archetype

import com.pauperinfo.card.enums.Color
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service

// colors is the archetype's color identity, taken from its decks (the most common
// deck color set). overallWinrate / overallMatches are the scraped aggregate win
// rate (percent) and total games behind it, or null if no matchup data was scraped.
data class ArchetypeSummary(
    val name: String,
    val deckCount: Long,
    val colors: List<Color>,
    val overallWinrate: Int?,
    val overallMatches: Int?,
)

data class ArchetypeCardWeight(val name: String, val inclusion: Float)

// One head-to-head matchup: win rate (percent) vs [opponent] over [matches] games.
data class ArchetypeMatchupWeight(val opponent: String, val winrate: Int, val matches: Int)

// An archetype a card belongs to, with how central the card is to it (inclusion).
data class CardArchetype(val archetype: String, val inclusion: Float)

data class ArchetypeDetail(
    val name: String,
    val deckCount: Long,
    // Color identity, taken from the archetype's decks (the most common color set).
    val colors: List<Color>,
    // Aggregate win rate across all matchups (the scraped "Overall" figure), or null
    // if no matchup data was scraped for this archetype.
    val overallWinrate: Int?,
    val overallMatches: Int?,
    // Match win rates (percent) computed from your own recorded tournament and casual
    // matches, with the number of matches behind each. Null when none recorded.
    val tournamentWinrate: Int?,
    val tournamentMatches: Int,
    val casualWinrate: Int?,
    val casualMatches: Int,
    val cards: List<ArchetypeCardWeight>,
    val matchups: List<ArchetypeMatchupWeight>,
)

@Service
class ArchetypeQueryService(
    @PersistenceContext private val entityManager: EntityManager,
    private val archetypeCardRepository: ArchetypeCardRepository,
    private val archetypeMatchupRepository: ArchetypeMatchupRepository,
) {

    // All archetypes that decks were classified into, with deck counts (desc).
    @Suppress("UNCHECKED_CAST")
    fun list(): List<ArchetypeSummary> {
        // Left-join the scraped "Overall" matchup row for each archetype's aggregate
        // win rate (one such row per archetype, so it's safe to group by it).
        val rows = entityManager.createNativeQuery(
            """
            SELECT d.archetype, count(*) AS decks, m.winrate, m.matches
            FROM metagame.deck d
            LEFT JOIN metagame.archetype_matchup m
              ON m.archetype = d.archetype AND m.opponent = 'Overall'
            WHERE d.archetype IS NOT NULL
            GROUP BY d.archetype, m.winrate, m.matches
            ORDER BY decks DESC
            """.trimIndent()
        ).resultList as List<Array<Any?>>
        val colorsByArchetype = colorsByArchetype()
        return rows.map {
            val name = it[0] as String
            ArchetypeSummary(
                name,
                (it[1] as Number).toLong(),
                colorsByArchetype[name] ?: emptyList(),
                (it[2] as Number?)?.toInt(),
                (it[3] as Number?)?.toInt(),
            )
        }
    }

    // An archetype's color identity is derived from the cards that define it: a color
    // counts if some profile card of that color is a defining staple (inclusion >=
    // [COLOR_INCLUSION_THRESHOLD]). This ignores splash one-ofs; a deck whose colored
    // cards are all fringe (e.g. an artifact/Tron shell) yields no colors (colorless).
    @Suppress("UNCHECKED_CAST")
    private fun colorsByArchetype(): Map<String, List<Color>> {
        val rows = entityManager.createNativeQuery(
            """
            SELECT ac.archetype, col
            FROM metagame.archetype_card ac
            JOIN metagame.card c ON c.name = ac.card_name, unnest(c.colors) AS col
            GROUP BY ac.archetype, col
            HAVING max(ac.inclusion) >= :threshold
            """.trimIndent()
        ).setParameter("threshold", COLOR_INCLUSION_THRESHOLD).resultList as List<Array<Any?>>
        return rows.groupBy({ it[0] as String }, { it[1] as String })
            .mapValues { (_, names) -> orderColors(names.toSet()) }
    }

    // Card-derived colors for one archetype (see colorsByArchetype).
    @Suppress("UNCHECKED_CAST")
    private fun colorsFor(name: String): List<Color> {
        val names = entityManager.createNativeQuery(
            """
            SELECT col
            FROM metagame.archetype_card ac
            JOIN metagame.card c ON c.name = ac.card_name, unnest(c.colors) AS col
            WHERE ac.archetype = :name
            GROUP BY col
            HAVING max(ac.inclusion) >= :threshold
            """.trimIndent()
        ).setParameter("name", name)
            .setParameter("threshold", COLOR_INCLUSION_THRESHOLD)
            .resultList as List<String>
        return orderColors(names.toSet())
    }

    // Canonical WUBRG order (the Color enum's declaration order).
    private fun orderColors(names: Set<String>): List<Color> =
        Color.entries.filter { it.name in names }

    // Deck count + the scraped card profile (how the archetype is classified).
    fun get(name: String): ArchetypeDetail? {
        val deckCount = (entityManager.createNativeQuery(
            "SELECT count(*) FROM metagame.deck WHERE archetype = :name"
        ).setParameter("name", name).singleResult as Number).toLong()

        val cards = archetypeCardRepository.findByArchetypeOrderByInclusionDesc(name)
            .map { ArchetypeCardWeight(it.cardName, it.inclusion) }

        // Split the scraped matchups into the aggregate "Overall" figure and the
        // per-opponent matchups (most-played first).
        val allMatchups = archetypeMatchupRepository.findByArchetypeOrderByMatchesDesc(name)
        val overall = allMatchups.firstOrNull { it.opponent == ArchetypeScrapeService.OVERALL }
        val matchups = allMatchups
            .filter { it.opponent != ArchetypeScrapeService.OVERALL }
            .map { ArchetypeMatchupWeight(it.opponent, it.winrate, it.matches) }

        // Unknown archetype: no decks and no profile.
        if (deckCount == 0L && cards.isEmpty() && allMatchups.isEmpty()) return null

        val tournament = recordWinrate(name, tournamentRows(name))
        val casual = recordWinrate(name, casualRows(name))
        return ArchetypeDetail(
            name, deckCount, colorsFor(name),
            overall?.winrate, overall?.matches,
            tournament.first, tournament.second,
            casual.first, casual.second,
            cards, matchups,
        )
    }

    // Reported tournament matches involving [name] on either side, as rows of
    // (p1 archetype, p2 archetype, p1 game wins, p2 game wins).
    @Suppress("UNCHECKED_CAST")
    private fun tournamentRows(name: String): List<Array<Any?>> =
        entityManager.createNativeQuery(
            """
            SELECT p1.archetype, p2.archetype, m.player1_wins, m.player2_wins
            FROM tournament.match m
            JOIN tournament.player p1 ON p1.id = m.player1_id
            JOIN tournament.player p2 ON p2.id = m.player2_id
            WHERE m.reported = true AND m.player2_id IS NOT NULL
              AND (lower(p1.archetype) = lower(:name) OR lower(p2.archetype) = lower(:name))
            """.trimIndent()
        ).setParameter("name", name).resultList as List<Array<Any?>>

    // Casual matches involving [name] on either side, in the same row shape.
    @Suppress("UNCHECKED_CAST")
    private fun casualRows(name: String): List<Array<Any?>> =
        entityManager.createNativeQuery(
            """
            SELECT player1_archetype, player2_archetype, player1_wins, player2_wins
            FROM casual.match
            WHERE lower(player1_archetype) = lower(:name) OR lower(player2_archetype) = lower(:name)
            """.trimIndent()
        ).setParameter("name", name).resultList as List<Array<Any?>>

    // Match win rate (percent) and match count for [name] over the given rows.
    // Mirrors (both sides the archetype) are skipped since they can't be attributed.
    private fun recordWinrate(name: String, rows: List<Array<Any?>>): Pair<Int?, Int> {
        var wins = 0
        var matches = 0
        for (r in rows) {
            val a1 = (r[0] as String?)?.trim()
            val a2 = (r[1] as String?)?.trim()
            val p1Wins = (r[2] as Number).toInt()
            val p2Wins = (r[3] as Number).toInt()
            val mineIsP1 = a1.equals(name, ignoreCase = true)
            val mineIsP2 = a2.equals(name, ignoreCase = true)
            // Skip mirrors (both sides this archetype) - can't be attributed.
            if (mineIsP1 && mineIsP2) continue
            val mine = if (mineIsP1) p1Wins else p2Wins
            val theirs = if (mineIsP1) p2Wins else p1Wins
            matches++
            if (mine > theirs) wins++
        }
        return if (matches == 0) null to 0 else Math.round(wins * 100.0 / matches).toInt() to matches
    }

    // Archetypes whose scraped profile includes the given card (most-central first).
    fun archetypesForCard(cardName: String): List<CardArchetype> =
        archetypeCardRepository.findByCardNameOrderByInclusionDesc(cardName)
            .map { CardArchetype(it.archetype, it.inclusion) }

    companion object {
        // A color counts toward an archetype's identity only if one of its cards of
        // that color appears in at least this fraction of the archetype's decks.
        private const val COLOR_INCLUSION_THRESHOLD = 0.5
    }
}
