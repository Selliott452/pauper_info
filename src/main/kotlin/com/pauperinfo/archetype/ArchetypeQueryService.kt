package com.pauperinfo.archetype

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service

data class ArchetypeSummary(val name: String, val deckCount: Long)

data class ArchetypeCardWeight(val name: String, val inclusion: Float)

data class ArchetypeDetail(
    val name: String,
    val deckCount: Long,
    val cards: List<ArchetypeCardWeight>,
)

@Service
class ArchetypeQueryService(
    @PersistenceContext private val entityManager: EntityManager,
    private val archetypeCardRepository: ArchetypeCardRepository,
) {

    // All archetypes that decks were classified into, with deck counts (desc).
    @Suppress("UNCHECKED_CAST")
    fun list(): List<ArchetypeSummary> {
        val rows = entityManager.createNativeQuery(
            """
            SELECT archetype, count(*) AS decks
            FROM deck WHERE archetype IS NOT NULL
            GROUP BY archetype
            ORDER BY decks DESC
            """.trimIndent()
        ).resultList as List<Array<Any?>>
        return rows.map { ArchetypeSummary(it[0] as String, (it[1] as Number).toLong()) }
    }

    // Deck count + the scraped card profile (how the archetype is classified).
    fun get(name: String): ArchetypeDetail? {
        val deckCount = (entityManager.createNativeQuery(
            "SELECT count(*) FROM deck WHERE archetype = :name"
        ).setParameter("name", name).singleResult as Number).toLong()

        val cards = archetypeCardRepository.findByArchetypeOrderByInclusionDesc(name)
            .map { ArchetypeCardWeight(it.cardName, it.inclusion) }

        // Unknown archetype: no decks and no profile.
        if (deckCount == 0L && cards.isEmpty()) return null
        return ArchetypeDetail(name, deckCount, cards)
    }
}
