package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.CardType
import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.repositories.CardRepository
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service
import java.sql.Array as SqlArray
import java.util.UUID

@Service
class CardStatisticsService(
    @PersistenceContext private val entityManager: EntityManager,
    private val cardRepository: CardRepository,
) {

    @Suppress("UNCHECKED_CAST")
    fun getStatistics(
        colors: List<Color>?,
        includeColorless: Boolean,
        exactColors: Boolean,
        names: List<String>?,
        types: List<CardType>?,
        minMainboardDecks: Int?,
        minSideboardDecks: Int?,
        sortBy: CardStatSort,
        direction: SortDirection,
        limit: Int,
        offset: Int,
    ): List<CardStatistics> {
        val sql = StringBuilder(SELECT_FROM)
        val params = mutableMapOf<String, Any>()

        val where = buildList {
            // Color filter. Colorless is its own selectable value (includeColorless):
            // colored cards must be non-empty and within the selected set (subset/identity),
            // colorless cards (empty color array) only match when explicitly included.
            // Color enum values are inlined safely (no user-supplied strings).
            val colorClauses = buildList {
                if (!colors.isNullOrEmpty()) {
                    val literal = colors.joinToString(",") { "'${it.name}'" }
                    if (exactColors) {
                        // Card's color set equals the selected set exactly.
                        add("(c.colors <@ ARRAY[$literal]::text[] AND c.colors @> ARRAY[$literal]::text[])")
                    } else {
                        // Within identity: card's colors are within the selected set.
                        add("(coalesce(cardinality(c.colors), 0) > 0 AND c.colors <@ ARRAY[$literal]::text[])")
                    }
                }
                if (includeColorless) {
                    add("coalesce(cardinality(c.colors), 0) = 0")
                }
            }
            if (colorClauses.isNotEmpty()) {
                add("(${colorClauses.joinToString(" OR ")})")
            }
            // Name filter uses a bound parameter — names are arbitrary user input.
            if (!names.isNullOrEmpty()) {
                add("c.name IN (:names)")
                params["names"] = names
            }
            // Type filter: a card matches if its type line contains any selected type
            // (e.g. "Artifact Creature — Construct" matches both Artifact and Creature).
            // Each value is a bound parameter — arbitrary user input.
            if (!types.isNullOrEmpty()) {
                val typeClauses = types.mapIndexed { i, type ->
                    params["type$i"] = "%${type.label}%"
                    "c.type_line ILIKE :type$i"
                }
                add("(${typeClauses.joinToString(" OR ")})")
            }
        }
        if (where.isNotEmpty()) {
            sql.append(" WHERE ${where.joinToString(" AND ")} ")
        }

        sql.append(GROUP_BY)

        // minMainboardDecks / minSideboardDecks are bound integers — safe to inline.
        val having = buildList {
            if (minMainboardDecks != null) {
                add("COUNT(DISTINCT CASE WHEN dc.board = 'mainboard' THEN dc.deck_id END) >= $minMainboardDecks")
            }
            if (minSideboardDecks != null) {
                add("COUNT(DISTINCT CASE WHEN dc.board = 'sideboard' THEN dc.deck_id END) >= $minSideboardDecks")
            }
        }
        if (having.isNotEmpty()) {
            sql.append(" HAVING ${having.joinToString(" AND ")} ")
        }

        // sortBy.column and direction are enum-derived, limit/offset are integers — all safe to inline.
        sql.append(" ORDER BY ${sortBy.column} ${direction.name} NULLS LAST ")
        sql.append(" LIMIT $limit OFFSET $offset ")

        val query = entityManager.createNativeQuery(sql.toString())
        params.forEach { (key, value) -> query.setParameter(key, value) }

        val rows = query.resultList as List<Array<Any?>>
        return rows.map { it.toCardStatistics() }
    }

    @Suppress("UNCHECKED_CAST")
    fun getStatisticsForCardName(name: String): CardStatistics? {
        val sql = SELECT_FROM + " WHERE c.name = :name " + GROUP_BY
        val rows = entityManager.createNativeQuery(sql)
            .setParameter("name", name)
            .resultList as List<Array<Any?>>
        return rows.firstOrNull()?.toCardStatistics()
    }

    fun getAllCardNames(): List<String> = cardRepository.findAllNames()

    // Cards that share mainboard decks with the target card, by distinct deck count.
    @Suppress("UNCHECKED_CAST")
    fun getCooccurrences(name: String, limit: Int): CardCooccurrence? {
        val card = cardRepository.findByName(name) ?: return null

        val deckCount = (entityManager.createNativeQuery(
            "SELECT COUNT(DISTINCT deck_id) FROM deck_card WHERE card_id = :targetId AND board = 'mainboard'"
        ).setParameter("targetId", card.id).singleResult as Number).toLong()

        // limit is an integer — safe to inline. targetId is a bound parameter.
        val sql = """
            SELECT c.id, c.name, c.colors, COUNT(DISTINCT dc.deck_id) AS deck_count
            FROM deck_card dc
            JOIN card c ON c.id = dc.card_id
            WHERE dc.board = 'mainboard'
              AND dc.card_id <> :targetId
              AND dc.deck_id IN (
                  SELECT deck_id FROM deck_card WHERE card_id = :targetId AND board = 'mainboard'
              )
            GROUP BY c.id, c.name, c.colors
            ORDER BY deck_count DESC
            LIMIT $limit
        """.trimIndent()

        val rows = entityManager.createNativeQuery(sql)
            .setParameter("targetId", card.id)
            .resultList as List<Array<Any?>>

        val cooccurrences = rows.map { row ->
            CooccurringCard(
                id = row[0] as UUID,
                name = row[1] as String,
                colors = parseColors(row[2]),
                deckCount = (row[3] as Number).toLong(),
            )
        }
        return CardCooccurrence(cardName = card.name, deckCount = deckCount, cooccurrences = cooccurrences)
    }

    // Combines card metadata with its play statistics for the single-card view.
    fun getCardDetail(name: String): CardDetail? {
        val card = cardRepository.findByName(name) ?: return null
        val stats = getStatisticsForCardName(name)
        return CardDetail(
            id = card.id,
            name = card.name,
            manaCost = card.manaCost,
            cmc = card.cmc,
            typeLine = card.typeLine,
            oracleText = card.oracleText,
            power = card.power,
            toughness = card.toughness,
            colors = card.colors.toList(),
            rarity = card.rarity,
            setCode = card.setCode,
            imageUri = card.imageUri,
            backImageUri = card.backImageUri,
            mainboardDeckCount = stats?.mainboardDeckCount ?: 0,
            sideboardDeckCount = stats?.sideboardDeckCount ?: 0,
            avgMainboardQuantity = stats?.avgMainboardQuantity,
            avgSideboardQuantity = stats?.avgSideboardQuantity,
            avgTotalQuantity = stats?.avgTotalQuantity,
        )
    }

    private fun Array<Any?>.toCardStatistics() = CardStatistics(
        id = this[0] as UUID,
        name = this[1] as String,
        colors = parseColors(this[2]),
        mainboardDeckCount = (this[3] as Number).toLong(),
        sideboardDeckCount = (this[4] as Number).toLong(),
        avgMainboardQuantity = (this[5] as? Number)?.toDouble(),
        avgSideboardQuantity = (this[6] as? Number)?.toDouble(),
        avgTotalQuantity = (this[7] as? Number)?.toDouble(),
    )

    private fun parseColors(value: Any?): List<Color> = when (value) {
        null -> emptyList()
        is SqlArray -> (value.array as Array<*>).map { Color.valueOf(it as String) }
        is Array<*> -> value.map { Color.valueOf(it as String) }
        // Postgres returns array columns as their text representation, e.g. "{BLUE,WHITE}".
        is String -> value.trim('{', '}')
            .split(',')
            .filter { it.isNotBlank() }
            .map { Color.valueOf(it.trim('"')) }
        else -> emptyList()
    }

    companion object {
        private val SELECT_FROM = """
            SELECT c.id, c.name, c.colors,
              COUNT(DISTINCT CASE WHEN dc.board = 'mainboard' THEN dc.deck_id END) AS mainboard_count,
              COUNT(DISTINCT CASE WHEN dc.board = 'sideboard' THEN dc.deck_id END) AS sideboard_count,
              AVG(CASE WHEN dc.board = 'mainboard' THEN dc.quantity END) AS avg_mainboard_qty,
              AVG(CASE WHEN dc.board = 'sideboard' THEN dc.quantity END) AS avg_sideboard_qty,
              SUM(dc.quantity)::float / NULLIF(COUNT(DISTINCT dc.deck_id), 0) AS avg_total_qty
            FROM card c
            LEFT JOIN deck_card dc ON dc.card_id = c.id
        """.trimIndent()

        private const val GROUP_BY = " GROUP BY c.id, c.name, c.colors "
    }
}
