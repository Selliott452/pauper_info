package com.pauperinfo.archetype

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service

// overallWinrate / overallMatches are the scraped aggregate win rate (percent)
// and total games behind it, or null if no matchup data was scraped.
data class ArchetypeSummary(
    val name: String,
    val deckCount: Long,
    val overallWinrate: Int?,
    val overallMatches: Int?,
)

data class ArchetypeCardWeight(val name: String, val inclusion: Float)

// One head-to-head matchup: win rate (percent) vs [opponent] over [matches] games.
data class ArchetypeMatchupWeight(val opponent: String, val winrate: Int, val matches: Int)

data class ArchetypeDetail(
    val name: String,
    val deckCount: Long,
    // Aggregate win rate across all matchups (the scraped "Overall" figure), or null
    // if no matchup data was scraped for this archetype.
    val overallWinrate: Int?,
    val overallMatches: Int?,
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
            FROM deck d
            LEFT JOIN archetype_matchup m
              ON m.archetype = d.archetype AND m.opponent = 'Overall'
            WHERE d.archetype IS NOT NULL
            GROUP BY d.archetype, m.winrate, m.matches
            ORDER BY decks DESC
            """.trimIndent()
        ).resultList as List<Array<Any?>>
        return rows.map {
            ArchetypeSummary(
                it[0] as String,
                (it[1] as Number).toLong(),
                (it[2] as Number?)?.toInt(),
                (it[3] as Number?)?.toInt(),
            )
        }
    }

    // Deck count + the scraped card profile (how the archetype is classified).
    fun get(name: String): ArchetypeDetail? {
        val deckCount = (entityManager.createNativeQuery(
            "SELECT count(*) FROM deck WHERE archetype = :name"
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
        return ArchetypeDetail(name, deckCount, overall?.winrate, overall?.matches, cards, matchups)
    }
}
