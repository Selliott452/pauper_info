package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.ColorColumn
import com.pauperinfo.card.repositories.CardRepository
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class DeckQueryService(
    @PersistenceContext private val entityManager: EntityManager,
    private val deckRepository: DeckRepository,
    private val cardRepository: CardRepository,
) {

    fun getDeck(publicId: String): DeckDetail? {
        val deck = deckRepository.findByPublicId(publicId) ?: return null

        // archetype is maintained by the classifier (JDBC), not the Deck entity,
        // so read the column directly to avoid the sync ever clobbering it.
        val archetypeRow = entityManager.createNativeQuery(
            "SELECT archetype, archetype_confidence FROM metagame.deck WHERE public_id = :id"
        ).setParameter("id", publicId).resultList.firstOrNull() as Array<*>?
        val archetype = archetypeRow?.get(0) as String?
        val archetypeConfidence = archetypeRow?.get(1) as String?

        // Resolve card metadata for every line in one batch (cardId is the surrogate).
        val cardIds = deck.cards.map { it.cardId }.distinct()
        val cardsById = cardRepository.findAllById(cardIds).associateBy { it.id }

        fun entriesFor(board: Board) = deck.cards
            .filter { it.board == board }
            .mapNotNull { dc ->
                val card = cardsById[dc.cardId] ?: return@mapNotNull null
                DeckCardEntry(
                    cardId = card.scryfallId,
                    name = card.name,
                    manaCost = card.manaCost,
                    cmc = card.cmc,
                    typeLine = card.typeLine,
                    colors = card.colors.toList(),
                    imageUri = card.imageUri,
                    quantity = dc.quantity,
                )
            }
            .sortedBy { it.name }

        return DeckDetail(
            id = deck.publicId,
            name = deck.name,
            author = deck.author,
            colors = deck.colors?.toList() ?: emptyList(),
            createdAt = deck.createdAt,
            updatedAt = deck.updatedAt,
            archetype = archetype,
            archetypeConfidence = archetypeConfidence,
            mainboard = entriesFor(Board.MAINBOARD),
            sideboard = entriesFor(Board.SIDEBOARD),
        )
    }

    // Built filter clause shared by listDecks and countDecks. Null means an
    // unknown card name was requested, so the result set is empty.
    private class DeckFilter(val whereClause: String, val params: Map<String, Any>)

    private fun buildFilter(
        colors: List<Color>?,
        exactColors: Boolean,
        author: String?,
        name: String?,
        archetypes: List<String>?,
        confidences: List<String>?,
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
        updatedWithinDays: Int? = null,
    ): DeckFilter? {
        val mainboardIds = mainboardCards?.takeIf { it.isNotEmpty() }
            ?.map { cardRepository.findByName(it)?.id ?: return null }
        val sideboardIds = sideboardCards?.takeIf { it.isNotEmpty() }
            ?.map { cardRepository.findByName(it)?.id ?: return null }

        val params = mutableMapOf<String, Any>()
        val where = buildList {
            if (!colors.isNullOrEmpty()) {
                val literal = colors.joinToString(",") { "'${it.name}'" }
                val deckColors = "coalesce(d.colors, '{}')"
                if (exactColors) {
                    // Deck's color set equals the selected set exactly (subset both ways).
                    add("$deckColors <@ ARRAY[$literal]::text[] AND $deckColors @> ARRAY[$literal]::text[]")
                } else {
                    // Within identity: deck's colors are a subset of the selected set.
                    add("$deckColors <@ ARRAY[$literal]::text[]")
                }
            }
            if (!author.isNullOrBlank()) {
                add("d.author ILIKE :author")
                params["author"] = "%$author%"
            }
            if (!name.isNullOrBlank()) {
                add("d.name ILIKE :name")
                params["name"] = "%$name%"
            }
            if (!archetypes.isNullOrEmpty()) {
                add("d.archetype IN (:archetypes)")
                params["archetypes"] = archetypes
            }
            if (!confidences.isNullOrEmpty()) {
                add("d.archetype_confidence IN (:confidences)")
                params["confidences"] = confidences
            }
            // Updated within the last N days. N is a bound integer — safe to inline.
            if (updatedWithinDays != null && updatedWithinDays > 0) {
                add("d.updated_at >= now() - INTERVAL '$updatedWithinDays days'")
            }
            // Deck must contain every required card in the given board.
            if (mainboardIds != null) {
                add(containmentClause(Board.MAINBOARD, "mbIds", mainboardIds.size))
                params["mbIds"] = mainboardIds
            }
            if (sideboardIds != null) {
                add(containmentClause(Board.SIDEBOARD, "sbIds", sideboardIds.size))
                params["sbIds"] = sideboardIds
            }
        }
        val whereClause = if (where.isNotEmpty()) " WHERE ${where.joinToString(" AND ")} " else ""
        return DeckFilter(whereClause, params)
    }

    @Suppress("UNCHECKED_CAST")
    fun listDecks(
        colors: List<Color>?,
        exactColors: Boolean,
        author: String?,
        name: String?,
        archetypes: List<String>?,
        confidences: List<String>?,
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
        limit: Int,
        offset: Int,
    ): List<DeckSummary> {
        val filter = buildFilter(colors, exactColors, author, name, archetypes, confidences, mainboardCards, sideboardCards)
            ?: return emptyList()
        val sql = """
            SELECT d.public_id, d.name, d.author, d.colors, d.archetype, d.archetype_confidence
            FROM metagame.deck d
            ${filter.whereClause}
            ORDER BY d.updated_at DESC NULLS LAST
            LIMIT $limit OFFSET $offset
        """.trimIndent()
        val query = entityManager.createNativeQuery(sql)
        filter.params.forEach { (k, v) -> query.setParameter(k, v) }
        val rows = query.resultList as List<Array<Any?>>
        return rows.map { it.toDeckSummary() }
    }

    fun countDecks(
        colors: List<Color>?,
        exactColors: Boolean,
        author: String?,
        name: String?,
        archetypes: List<String>?,
        confidences: List<String>?,
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
    ): Long {
        val filter = buildFilter(colors, exactColors, author, name, archetypes, confidences, mainboardCards, sideboardCards)
            ?: return 0
        val sql = "SELECT COUNT(*) FROM metagame.deck d ${filter.whereClause}"
        val query = entityManager.createNativeQuery(sql)
        filter.params.forEach { (k, v) -> query.setParameter(k, v) }
        return (query.singleResult as Number).toLong()
    }

    // A single random deck matching the optional filters, or null if none match.
    @Suppress("UNCHECKED_CAST")
    fun randomDeck(
        archetypes: List<String>?,
        confidences: List<String>?,
        updatedWithinDays: Int?,
    ): DeckSummary? {
        val filter = buildFilter(null, false, null, null, archetypes, confidences, null, null, updatedWithinDays)
            ?: return null
        val sql = """
            SELECT d.public_id, d.name, d.author, d.colors, d.archetype, d.archetype_confidence
            FROM metagame.deck d
            ${filter.whereClause}
            ORDER BY random()
            LIMIT 1
        """.trimIndent()
        val query = entityManager.createNativeQuery(sql)
        filter.params.forEach { (k, v) -> query.setParameter(k, v) }
        val rows = query.resultList as List<Array<Any?>>
        return rows.firstOrNull()?.toDeckSummary()
    }

    // Subquery requiring a deck to contain all of the given cards in one board.
    // board is the Board enum ordinal stored in the smallint column.
    private fun containmentClause(board: Board, paramKey: String, count: Int) = """
        d.id IN (
            SELECT deck_id FROM metagame.deck_card
            WHERE card_id IN (:$paramKey) AND board = ${board.ordinal}
            GROUP BY deck_id
            HAVING COUNT(DISTINCT card_id) = $count
        )
    """.trimIndent()

    private fun Array<Any?>.toDeckSummary() = DeckSummary(
        id = this[0] as String,
        name = this[1] as String?,
        author = this[2] as String?,
        colors = ColorColumn.parse(this[3]),
        archetype = this[4] as String?,
        archetypeConfidence = this[5] as String?,
    )
}
