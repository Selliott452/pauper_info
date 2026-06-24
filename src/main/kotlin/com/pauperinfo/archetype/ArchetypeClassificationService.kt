package com.pauperinfo.archetype

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.stream.Stream
import javax.sql.DataSource

data class ArchetypeScore(val archetype: String, val score: Double)

@Service
class ArchetypeClassificationService(
    @PersistenceContext private val entityManager: EntityManager,
    private val archetypeCardRepository: ArchetypeCardRepository,
    private val dataSource: DataSource,
) {

    private val log = LoggerFactory.getLogger(ArchetypeClassificationService::class.java)

    private fun buildClassifier(threshold: Double) =
        ArchetypeClassifier(archetypeCardRepository.findAll(), threshold)

    /** Debug: ranked archetype scores for a single deck's mainboard (by public id). */
    @Suppress("UNCHECKED_CAST")
    fun rankForDeck(deckId: String, limit: Int): List<ArchetypeScore> {
        val cards = entityManager.createNativeQuery(
            """
            SELECT c.name FROM metagame.deck_card dc
            JOIN metagame.card c ON c.id = dc.card_id
            JOIN metagame.deck d ON d.id = dc.deck_id
            WHERE d.public_id = :id AND dc.board = 0
            """.trimIndent()
        ).setParameter("id", deckId).resultList as List<String>

        return buildClassifier(0.0).rank(cards)
            .take(limit)
            .map { (archetype, score) -> ArchetypeScore(archetype, score) }
    }

    /** Classify every deck's mainboard and persist the label. */
    @Async
    @Transactional
    @Suppress("UNCHECKED_CAST")
    fun classifyAll(threshold: Double) {
        val classifier = buildClassifier(threshold)
        log.info("Classifying decks into archetypes (threshold=$threshold)")

        // surrogate deck id -> (archetype, confidence). confidence is null for Other.
        val labels = HashMap<Int, Pair<String, String?>>()
        val stream = entityManager.createNativeQuery(
            """
            SELECT dc.deck_id, c.name FROM metagame.deck_card dc
            JOIN metagame.card c ON c.id = dc.card_id
            WHERE dc.board = 0
            ORDER BY dc.deck_id
            """.trimIndent()
        ).resultStream as Stream<Array<Any?>>

        fun label(cards: List<String>): Pair<String, String?> {
            val ranked = classifier.rank(cards)
            val best = classifier.classify(cards)
            return if (best == null) OTHER to null else best to classifier.confidence(ranked)
        }

        var current: Int? = null
        val cards = ArrayList<String>()
        stream.use {
            it.forEach { row ->
                val deckId = (row[0] as Number).toInt()
                if (deckId != current) {
                    current?.let { labels[it] = label(cards) }
                    current = deckId
                    cards.clear()
                }
                cards.add(row[1] as String)
            }
        }
        current?.let { labels[it] = label(cards) }

        persist(labels)
        val classified = labels.values.count { it.first != OTHER }
        log.info("Archetype classification complete: ${labels.size} decks (${classified} matched, ${labels.size - classified} Other)")
    }

    private fun persist(labels: Map<Int, Pair<String, String?>>) {
        dataSource.connection.use { conn ->
            conn.autoCommit = false
            conn.prepareStatement("UPDATE metagame.deck SET archetype = ?, archetype_confidence = ? WHERE id = ?").use { ps ->
                var i = 0
                for ((id, label) in labels) {
                    ps.setString(1, label.first)
                    ps.setString(2, label.second)
                    ps.setInt(3, id)
                    ps.addBatch()
                    if (++i % 1000 == 0) ps.executeBatch()
                }
                ps.executeBatch()
            }
            conn.commit()
        }
    }

    companion object {
        const val OTHER = "Other"
    }
}
