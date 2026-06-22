package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
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

    fun getDeck(id: String): DeckDetail? {
        val deck = deckRepository.findById(id).orElse(null) ?: return null

        // Resolve card metadata for every line in one batch.
        val cardIds = deck.cards.map { it.cardId }.distinct()
        val cardsById = cardRepository.findAllById(cardIds).associateBy { it.id }

        fun entriesFor(board: String) = deck.cards
            .filter { it.board == board }
            .mapNotNull { dc ->
                val card = cardsById[dc.cardId] ?: return@mapNotNull null
                DeckCardEntry(
                    cardId = card.id,
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
            id = deck.id,
            name = deck.name,
            author = deck.author,
            colors = deck.colors?.toList() ?: emptyList(),
            createdAt = deck.createdAt,
            updatedAt = deck.updatedAt,
            mainboard = entriesFor("mainboard"),
            sideboard = entriesFor("sideboard"),
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
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
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
            // Deck must contain every required card in the given board.
            if (mainboardIds != null) {
                add(containmentClause("mainboard", "mbIds", mainboardIds.size))
                params["mbIds"] = mainboardIds
            }
            if (sideboardIds != null) {
                add(containmentClause("sideboard", "sbIds", sideboardIds.size))
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
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
        limit: Int,
        offset: Int,
    ): List<DeckSummary> {
        val filter = buildFilter(colors, exactColors, author, name, mainboardCards, sideboardCards)
            ?: return emptyList()
        val sql = """
            SELECT d.id, d.name, d.author, d.colors
            FROM deck d
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
        mainboardCards: List<String>?,
        sideboardCards: List<String>?,
    ): Long {
        val filter = buildFilter(colors, exactColors, author, name, mainboardCards, sideboardCards)
            ?: return 0
        val sql = "SELECT COUNT(*) FROM deck d ${filter.whereClause}"
        val query = entityManager.createNativeQuery(sql)
        filter.params.forEach { (k, v) -> query.setParameter(k, v) }
        return (query.singleResult as Number).toLong()
    }

    // Subquery requiring a deck to contain all of the given cards in one board.
    private fun containmentClause(board: String, paramKey: String, count: Int) = """
        d.id IN (
            SELECT deck_id FROM deck_card
            WHERE card_id IN (:$paramKey) AND board = '$board'
            GROUP BY deck_id
            HAVING COUNT(DISTINCT card_id) = $count
        )
    """.trimIndent()

    private fun Array<Any?>.toDeckSummary() = DeckSummary(
        id = this[0] as String,
        name = this[1] as String?,
        author = this[2] as String?,
        colors = parseColors(this[3]),
    )

    private fun parseColors(value: Any?): List<Color> = when (value) {
        null -> emptyList()
        is java.sql.Array -> (value.array as Array<*>).map { Color.valueOf(it as String) }
        is Array<*> -> value.map { Color.valueOf(it as String) }
        is String -> value.trim('{', '}').split(',').filter { it.isNotBlank() }.map { Color.valueOf(it.trim('"')) }
        else -> emptyList()
    }
}
