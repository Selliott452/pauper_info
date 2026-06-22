package com.pauperinfo.moxfield

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.repositories.CardRepository
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
    private val cardRepository: CardRepository,
    private val moxfieldClient: MoxfieldClient,
) {

    private val log = LoggerFactory.getLogger(MoxfieldDeckDetailSyncService::class.java)

    @Async
    fun syncDeckDetails() {
        // Resolve deck cards to our canonical card by name. The card table holds one
        // printing per card (Scryfall unique=cards), but decks reference arbitrary
        // printings, so joining on scryfall_id would miss most matches.
        val nameToId = cardRepository.findAll().associate { it.name to it.id }
        log.info("Loaded ${nameToId.size} cards for name resolution")

        val pending = deckRepository.findAllByNameIsNull()
        log.info("Deck detail sync starting: ${pending.size} decks to fetch")

        val completed = AtomicInteger(0)
        val failed = AtomicInteger(0)
        val executor = Executors.newFixedThreadPool(THREAD_COUNT)

        pending.forEach { deck ->
            executor.submit {
                try {
                    fetchAndPersist(deck.id, nameToId)
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
    fun fetchAndPersist(publicId: String, nameToId: Map<String, UUID>) {
        val detail = moxfieldClient.fetchDeckDetail(publicId)

        // Resolve each entry to a canonical card id by name, dropping cards we don't
        // track. Sum quantities per (card, board) so duplicate printings collapse to
        // one row and never collide on the (deck_id, card_id, board) primary key.
        val cards = sequenceOf("mainboard" to detail.boards.mainboard, "sideboard" to detail.boards.sideboard)
            .flatMap { (board, b) -> b.cards.values.asSequence().map { board to it } }
            .mapNotNull { (board, entry) ->
                nameToId[entry.card.name]?.let { cardId -> Triple(cardId, board, entry.quantity) }
            }
            .groupingBy { (cardId, board, _) -> cardId to board }
            .fold(0) { acc, (_, _, quantity) -> acc + quantity }
            .map { (key, quantity) -> DeckCard(key.first, quantity, key.second) }

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
