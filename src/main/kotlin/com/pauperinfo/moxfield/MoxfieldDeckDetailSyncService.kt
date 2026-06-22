package com.pauperinfo.moxfield

import com.pauperinfo.card.enums.Color
import com.pauperinfo.deck.Deck
import com.pauperinfo.deck.DeckCard
import com.pauperinfo.deck.DeckRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

@Service
class MoxfieldDeckDetailSyncService(
    private val deckRepository: DeckRepository,
    private val moxfieldClient: MoxfieldClient,
) {

    private val log = LoggerFactory.getLogger(MoxfieldDeckDetailSyncService::class.java)

    @Async
    fun syncDeckDetails() {
        val pending = deckRepository.findAllByNameIsNull()
        log.info("Deck detail sync starting: ${pending.size} decks to fetch")

        val completed = AtomicInteger(0)
        val failed = AtomicInteger(0)
        val executor = Executors.newFixedThreadPool(THREAD_COUNT)

        pending.forEach { deck ->
            executor.submit {
                try {
                    fetchAndPersist(deck.id)
                    val done = completed.incrementAndGet()
                    if (done % 500 == 0) {
                        log.info("Deck detail sync progress: $done / ${pending.size} (${failed.get()} failed)")
                    }
                } catch (e: DeckNotFoundException) {
                    log.info("Deleting deck ${deck.id} — no longer exists on Moxfield")
                    deckRepository.deleteById(deck.id)
                    failed.incrementAndGet()
                } catch (e: Exception) {
                    log.warn("Failed to fetch deck ${deck.id}: ${e.message}")
                    failed.incrementAndGet()
                }
            }
        }

        executor.shutdown()
        executor.awaitTermination(Long.MAX_VALUE, TimeUnit.MILLISECONDS)
        log.info("Deck detail sync complete: ${completed.get()} succeeded, ${failed.get()} failed")
    }

    @Transactional
    fun fetchAndPersist(publicId: String) {
        val detail = moxfieldClient.fetchDeckDetail(publicId)

        val cards = buildList {
            detail.boards.mainboard.cards.values.forEach { entry ->
                add(DeckCard(UUID.fromString(entry.card.scryfallId), entry.quantity, "mainboard"))
            }
            detail.boards.sideboard.cards.values.forEach { entry ->
                add(DeckCard(UUID.fromString(entry.card.scryfallId), entry.quantity, "sideboard"))
            }
        }

        val deck = Deck(
            id = detail.publicId,
            name = detail.name,
            author = detail.createdByUser.userName,
            colors = detail.colors.mapNotNull { code -> Color.entries.find { it.code == code } }.toTypedArray(),
            createdAt = OffsetDateTime.parse(detail.createdAtUtc),
            updatedAt = OffsetDateTime.parse(detail.lastUpdatedAtUtc),
            cards = cards,
        )
        deckRepository.save(deck)
    }

    companion object {
        const val THREAD_COUNT = 50
    }
}
