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

// One person's record playing this archetype, in tournaments or casual. playerId
// links to their profile (competitor id for tournaments, casual player id for casual);
// null when unknown. winRate is the match win rate (0..1) or null with no matches.
data class ArchetypePlayerRecord(
    val playerId: Int?,
    val name: String,
    val wins: Int,
    val losses: Int,
    val draws: Int,
    val winRate: Double?,
)

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
    // Who has played this archetype, with their record, in recorded tournaments and
    // casual games. Most matches first.
    val tournamentPlayers: List<ArchetypePlayerRecord>,
    val casualPlayers: List<ArchetypePlayerRecord>,
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
            tournamentPlayers(name), casualPlayers(name),
            cards, matchups,
        )
    }

    // Competitors who ran this archetype in recorded tournaments, with their match
    // record while playing it (across every event where they registered it).
    @Suppress("UNCHECKED_CAST")
    private fun tournamentPlayers(name: String): List<ArchetypePlayerRecord> {
        // player row id -> (competitor id, display name) for every registration of this archetype.
        val players = entityManager.createNativeQuery(
            """
            SELECT p.id, p.competitor_id, p.name
            FROM tournament.player p
            WHERE lower(btrim(p.archetype)) = lower(:name)
            """.trimIndent()
        ).setParameter("name", name).resultList as List<Array<Any?>>
        if (players.isEmpty()) return emptyList()

        val playerIds = players.map { (it[0] as Number).toInt() }
        // Group by competitor (falling back to name when there's no linked competitor).
        data class Key(val competitorId: Int?, val name: String)
        val keyByPlayerId = players.associate { row ->
            (row[0] as Number).toInt() to Key((row[1] as Number?)?.toInt(), row[2] as String)
        }

        val matches = entityManager.createNativeQuery(
            """
            SELECT m.player1_id, m.player2_id, m.player1_wins, m.player2_wins
            FROM tournament.match m
            WHERE m.reported = true AND m.player2_id IS NOT NULL
              AND (m.player1_id IN (:ids) OR m.player2_id IN (:ids))
            """.trimIndent()
        ).setParameter("ids", playerIds).resultList as List<Array<Any?>>

        val agg = LinkedHashMap<Key, IntArray>() // [wins, losses, draws]
        for (m in matches) {
            val p1 = (m[0] as Number).toInt()
            val p2 = (m[1] as Number).toInt()
            val p1Wins = (m[2] as Number).toInt()
            val p2Wins = (m[3] as Number).toInt()
            // Attribute the result to whichever side(s) registered this archetype.
            for (id in listOf(p1, p2)) {
                val key = keyByPlayerId[id] ?: continue
                val mine = if (id == p1) p1Wins else p2Wins
                val theirs = if (id == p1) p2Wins else p1Wins
                val b = agg.getOrPut(key) { IntArray(3) }
                when {
                    mine > theirs -> b[0]++
                    mine < theirs -> b[1]++
                    else -> b[2]++
                }
            }
        }
        return agg.entries
            .map { (k, b) -> playerRecord(k.competitorId, k.name, b) }
            .sortedByDescending { it.wins + it.losses + it.draws }
    }

    // Casual players who logged a match on this archetype, with their record on it.
    @Suppress("UNCHECKED_CAST")
    private fun casualPlayers(name: String): List<ArchetypePlayerRecord> {
        val rows = entityManager.createNativeQuery(
            """
            SELECT player1_id, player2_id, player1_archetype, player2_archetype, player1_wins, player2_wins
            FROM casual.match
            WHERE lower(btrim(player1_archetype)) = lower(:name)
               OR lower(btrim(player2_archetype)) = lower(:name)
            """.trimIndent()
        ).setParameter("name", name).resultList as List<Array<Any?>>
        if (rows.isEmpty()) return emptyList()

        val names = entityManager.createNativeQuery("SELECT id, name FROM casual.player")
            .resultList as List<Array<Any?>>
        val nameById = names.associate { (it[0] as Number).toInt() to it[1] as String }

        val agg = LinkedHashMap<Int, IntArray>() // playerId -> [wins, losses, draws]
        for (r in rows) {
            val p1 = (r[0] as Number).toInt()
            val p2 = (r[1] as Number).toInt()
            val a1 = (r[2] as String?)?.trim()
            val a2 = (r[3] as String?)?.trim()
            val p1Wins = (r[4] as Number).toInt()
            val p2Wins = (r[5] as Number).toInt()
            if (a1.equals(name, ignoreCase = true)) tallyCasual(agg, p1, p1Wins, p2Wins)
            if (a2.equals(name, ignoreCase = true)) tallyCasual(agg, p2, p2Wins, p1Wins)
        }
        return agg.entries
            .map { (id, b) -> playerRecord(id, nameById[id] ?: "?", b) }
            .sortedByDescending { it.wins + it.losses + it.draws }
    }

    private fun tallyCasual(agg: LinkedHashMap<Int, IntArray>, id: Int, mine: Int, theirs: Int) {
        val b = agg.getOrPut(id) { IntArray(3) }
        when {
            mine > theirs -> b[0]++
            mine < theirs -> b[1]++
            else -> b[2]++
        }
    }

    private fun playerRecord(playerId: Int?, name: String, b: IntArray): ArchetypePlayerRecord {
        val total = b[0] + b[1] + b[2]
        return ArchetypePlayerRecord(playerId, name, b[0], b[1], b[2], if (total == 0) null else Math.round(b[0] * 1000.0 / total) / 1000.0)
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

    // Per-opponent matchups for an archetype from a given source: "global" is the
    // scraped mtgdecks figures; "tournament"/"casual" are computed from your own
    // recorded matches. Sorted by sample size (most matches first).
    fun matchupsFor(name: String, source: String): List<ArchetypeMatchupWeight> = when (source) {
        "global" -> {
            val all = archetypeMatchupRepository.findByArchetypeOrderByMatchesDesc(name)
            all.filter { it.opponent != ArchetypeScrapeService.OVERALL }
                .map { ArchetypeMatchupWeight(it.opponent, it.winrate, it.matches) }
        }
        "tournament" -> opponentMatchups(name, tournamentRows(name))
        "casual" -> opponentMatchups(name, casualRows(name))
        else -> emptyList()
    }

    // Groups recorded match rows by opponent archetype, tallying [name]'s match win
    // rate vs each. Mirrors and rows with no opponent archetype are dropped.
    private fun opponentMatchups(name: String, rows: List<Array<Any?>>): List<ArchetypeMatchupWeight> {
        // opponent -> [wins, matches]
        val agg = LinkedHashMap<String, IntArray>()
        for (r in rows) {
            val a1 = (r[0] as String?)?.trim()
            val a2 = (r[1] as String?)?.trim()
            val p1Wins = (r[2] as Number).toInt()
            val p2Wins = (r[3] as Number).toInt()
            val mineIsP1 = a1.equals(name, ignoreCase = true)
            val opponent = (if (mineIsP1) a2 else a1)?.takeIf { it.isNotEmpty() } ?: continue
            // Skip mirrors (opponent is the same archetype).
            if (opponent.equals(name, ignoreCase = true)) continue
            val mine = if (mineIsP1) p1Wins else p2Wins
            val theirs = if (mineIsP1) p2Wins else p1Wins
            val b = agg.getOrPut(opponent) { IntArray(2) }
            b[1]++
            if (mine > theirs) b[0]++
        }
        return agg.entries
            .map { (opponent, b) -> ArchetypeMatchupWeight(opponent, Math.round(b[0] * 100.0 / b[1]).toInt(), b[1]) }
            .sortedByDescending { it.matches }
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
