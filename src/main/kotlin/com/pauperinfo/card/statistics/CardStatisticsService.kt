package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.CardType
import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.ColorColumn
import com.pauperinfo.card.repositories.CardRepository
import com.pauperinfo.deck.Board
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.PreparedStatement
import java.sql.Types
import java.util.UUID
import java.util.stream.Stream
import javax.sql.DataSource

@Service
class CardStatisticsService(
    @PersistenceContext private val entityManager: EntityManager,
    private val cardRepository: CardRepository,
    private val dataSource: DataSource,
) {

    private val log = LoggerFactory.getLogger(CardStatisticsService::class.java)

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
            // Minimum play thresholds filter the precomputed counts directly (no
            // aggregation needed). Unplayed cards have no stats row, so coalesce to 0.
            // Bound integers — safe to inline.
            if (minMainboardDecks != null) {
                add("coalesce(s.mainboard_count, 0) >= $minMainboardDecks")
            }
            if (minSideboardDecks != null) {
                add("coalesce(s.sideboard_count, 0) >= $minSideboardDecks")
            }
        }
        if (where.isNotEmpty()) {
            sql.append(" WHERE ${where.joinToString(" AND ")} ")
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
        val sql = "$SELECT_FROM WHERE c.name = :name"
        val rows = entityManager.createNativeQuery(sql)
            .setParameter("name", name)
            .resultList as List<Array<Any?>>
        return rows.firstOrNull()?.toCardStatistics()
    }

    fun getAllCardNames(): List<String> = cardRepository.findAllNames()

    /**
     * Recomputes the per-card play statistics (card_play_stats) from deck_card.
     *
     * Streams every deck_card row ordered by card, aggregates each card's counts
     * and averages in memory, then replaces the table in one batch. This is the
     * expensive work the grid used to do per request; run it after a deck sync
     * (POST /api/cards/statistics/refresh).
     */
    @Async
    @Transactional
    @Suppress("UNCHECKED_CAST")
    fun refreshStatistics() {
        log.info("Refreshing card play statistics")

        val stream = entityManager.createNativeQuery(
            "SELECT card_id, deck_id, board, quantity FROM metagame.deck_card ORDER BY card_id"
        ).resultStream as Stream<Array<Any?>>

        // Rows arrive grouped by card_id; accumulate one card at a time and emit a
        // stats row when the card changes. All ids are the narrow surrogate ints.
        val rows = ArrayList<CardStatsRow>()
        var currentId: Int? = null
        var acc = StatsAccumulator()

        fun flush() {
            currentId?.let { rows.add(acc.toRow(it)) }
        }

        stream.use {
            it.forEach { row ->
                val cardId = (row[0] as Number).toInt()
                if (cardId != currentId) {
                    flush()
                    currentId = cardId
                    acc = StatsAccumulator()
                }
                acc.add(
                    board = (row[2] as Number).toInt(),
                    quantity = (row[3] as Number).toInt(),
                    deckId = (row[1] as Number).toInt(),
                )
            }
        }
        flush()

        persistStatistics(rows)
        log.info("Card play statistics refreshed: ${rows.size} cards")
    }

    private fun persistStatistics(rows: List<CardStatsRow>) {
        dataSource.connection.use { conn ->
            conn.autoCommit = false
            conn.createStatement().use { it.executeUpdate("TRUNCATE metagame.card_play_stats") }
            conn.prepareStatement(
                """
                INSERT INTO metagame.card_play_stats
                  (card_id, mainboard_count, sideboard_count, avg_mainboard_qty, avg_sideboard_qty, avg_total_qty)
                VALUES (?, ?, ?, ?, ?, ?)
                """.trimIndent()
            ).use { ps ->
                var i = 0
                for (r in rows) {
                    ps.setInt(1, r.cardId)
                    ps.setInt(2, r.mainboardCount)
                    ps.setInt(3, r.sideboardCount)
                    ps.setNullableDouble(4, r.avgMainboardQuantity)
                    ps.setNullableDouble(5, r.avgSideboardQuantity)
                    ps.setNullableDouble(6, r.avgTotalQuantity)
                    ps.addBatch()
                    if (++i % 1000 == 0) ps.executeBatch()
                }
                ps.executeBatch()
            }
            conn.commit()
        }
    }

    private fun PreparedStatement.setNullableDouble(index: Int, value: Double?) {
        if (value == null) setNull(index, Types.DOUBLE) else setDouble(index, value)
    }

    // Cards that share mainboard decks with the target card, by distinct deck count.
    @Suppress("UNCHECKED_CAST")
    fun getCooccurrences(name: String, limit: Int): CardCooccurrence? {
        val card = cardRepository.findByName(name) ?: return null

        // board = 0 is the mainboard (Board enum ordinal). targetId is the surrogate id.
        val deckCount = (entityManager.createNativeQuery(
            "SELECT COUNT(DISTINCT deck_id) FROM metagame.deck_card WHERE card_id = :targetId AND board = 0"
        ).setParameter("targetId", card.id).singleResult as Number).toLong()

        // limit is an integer — safe to inline. targetId is a bound parameter.
        // scryfall_id is exposed as the card id (c.id is the internal surrogate).
        val sql = """
            SELECT c.scryfall_id, c.name, c.colors, COUNT(DISTINCT dc.deck_id) AS deck_count
            FROM metagame.deck_card dc
            JOIN metagame.card c ON c.id = dc.card_id
            WHERE dc.board = 0
              AND dc.card_id <> :targetId
              AND dc.deck_id IN (
                  SELECT deck_id FROM metagame.deck_card WHERE card_id = :targetId AND board = 0
              )
            GROUP BY c.scryfall_id, c.name, c.colors
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
                colors = ColorColumn.parse(row[2]),
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
            id = card.scryfallId,
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
        colors = ColorColumn.parse(this[2]),
        mainboardDeckCount = (this[3] as Number).toLong(),
        sideboardDeckCount = (this[4] as Number).toLong(),
        avgMainboardQuantity = (this[5] as? Number)?.toDouble(),
        avgSideboardQuantity = (this[6] as? Number)?.toDouble(),
        avgTotalQuantity = (this[7] as? Number)?.toDouble(),
    )

    // A computed stats row, ready to persist (cardId is the surrogate id).
    private data class CardStatsRow(
        val cardId: Int,
        val mainboardCount: Int,
        val sideboardCount: Int,
        val avgMainboardQuantity: Double?,
        val avgSideboardQuantity: Double?,
        val avgTotalQuantity: Double?,
    )

    // Accumulates one card's deck_card rows. Each (deck, card, board) is unique, so a
    // board's row count is its distinct-deck count; avg_total divides total copies by
    // the distinct decks playing the card across either board. board/deckId are the
    // smallint board ordinal and surrogate deck id.
    private class StatsAccumulator {
        private var mainboardCount = 0
        private var sideboardCount = 0
        private var mainboardCopies = 0L
        private var sideboardCopies = 0L
        private var totalCopies = 0L
        private val decks = HashSet<Int>()

        fun add(board: Int, quantity: Int, deckId: Int) {
            decks.add(deckId)
            totalCopies += quantity
            when (board) {
                Board.MAINBOARD.ordinal -> { mainboardCount++; mainboardCopies += quantity }
                Board.SIDEBOARD.ordinal -> { sideboardCount++; sideboardCopies += quantity }
            }
        }

        fun toRow(cardId: Int) = CardStatsRow(
            cardId = cardId,
            mainboardCount = mainboardCount,
            sideboardCount = sideboardCount,
            avgMainboardQuantity = if (mainboardCount > 0) mainboardCopies.toDouble() / mainboardCount else null,
            avgSideboardQuantity = if (sideboardCount > 0) sideboardCopies.toDouble() / sideboardCount else null,
            avgTotalQuantity = if (decks.isNotEmpty()) totalCopies.toDouble() / decks.size else null,
        )
    }

    companion object {
        // Reads the precomputed per-card aggregates (card_play_stats). Unplayed cards
        // have no stats row, so counts coalesce to 0 and averages stay null. The
        // aliases match CardStatSort.column so callers can ORDER BY them. scryfall_id
        // is exposed as the card's id (the surrogate c.id is internal only).
        private val SELECT_FROM = """
            SELECT c.scryfall_id, c.name, c.colors,
              coalesce(s.mainboard_count, 0) AS mainboard_count,
              coalesce(s.sideboard_count, 0) AS sideboard_count,
              s.avg_mainboard_qty AS avg_mainboard_qty,
              s.avg_sideboard_qty AS avg_sideboard_qty,
              s.avg_total_qty AS avg_total_qty
            FROM metagame.card c
            LEFT JOIN metagame.card_play_stats s ON s.card_id = c.id
        """.trimIndent()
    }
}
