package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.Color
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service
import java.sql.Array as SqlArray
import java.util.UUID

@Service
class CardStatisticsService(
    @PersistenceContext private val entityManager: EntityManager,
) {

    @Suppress("UNCHECKED_CAST")
    fun getStatistics(
        colors: List<Color>?,
        names: List<String>?,
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
            // Subset filter: a card matches if all of its colors fall within the requested set.
            // Values come from the Color enum, so inlining the array literal is injection-safe.
            if (!colors.isNullOrEmpty()) {
                val literal = colors.joinToString(",") { "'${it.name}'" }
                add("c.colors <@ ARRAY[$literal]::text[]")
            }
            // Name filter uses a bound parameter — names are arbitrary user input.
            if (!names.isNullOrEmpty()) {
                add("c.name IN (:names)")
                params["names"] = names
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
