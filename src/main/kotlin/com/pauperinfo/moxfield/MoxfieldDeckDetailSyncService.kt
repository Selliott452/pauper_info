package com.pauperinfo.moxfield

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.repositories.CardRepository
import com.pauperinfo.deck.Board
import com.pauperinfo.deck.Deck
import com.pauperinfo.deck.DeckCard
import com.pauperinfo.deck.DeckRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
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

    // all=false: fetch decks we haven't fetched yet (resumable, name IS NULL).
    // all=true: re-fetch and re-validate every deck (e.g. to apply legality rules).
    @Async
    fun syncDeckDetails(all: Boolean = false) {
        // Resolve deck cards to our canonical card by name. The card table holds one
        // printing per card (Scryfall unique=cards), but decks reference arbitrary
        // printings, so joining on scryfall_id would miss most matches.
        val nameToId = cardRepository.findAll().associate { it.name to it.id }
        log.info("Loaded ${nameToId.size} cards for name resolution")

        val pending = if (all) deckRepository.findAllPublicIds() else deckRepository.findPublicIdsByNameIsNull()
        log.info("Deck detail sync starting: ${pending.size} decks to fetch (all=$all)")

        val completed = AtomicInteger(0)
        val illegal = AtomicInteger(0)
        val failed = AtomicInteger(0)
        val executor = Executors.newFixedThreadPool(THREAD_COUNT)

        pending.forEach { deckId ->
            executor.submit {
                try {
                    if (!fetchAndPersist(deckId, nameToId)) illegal.incrementAndGet()
                    val done = completed.incrementAndGet()
                    if (done % 500 == 0) {
                        log.info("Deck detail sync progress: $done / ${pending.size} (${illegal.get()} illegal removed, ${failed.get()} failed)")
                    }
                } catch (e: DeckNotFoundException) {
                    log.info("Deleting deck $deckId — no longer exists on Moxfield")
                    deleteByPublicId(deckId)
                    failed.incrementAndGet()
                } catch (e: Exception) {
                    log.warn("Failed to fetch deck $deckId: ${e.message}")
                    failed.incrementAndGet()
                }
            }
        }

        executor.shutdown()
        executor.awaitTermination(Long.MAX_VALUE, TimeUnit.MILLISECONDS)
        log.info("Deck detail sync complete: ${completed.get()} processed, ${illegal.get()} illegal removed, ${failed.get()} failed")
    }

    // Returns false (and deletes the deck) if it is not pauper-legal.
    @Transactional
    fun fetchAndPersist(publicId: String, nameToId: Map<String, Int>): Boolean {
        val detail = moxfieldClient.fetchDeckDetail(publicId)

        if (!DeckLegality.isPauperLegal(detail)) {
            deleteByPublicId(publicId)
            return false
        }

        // Resolve each entry to a canonical card id by name, dropping cards we don't
        // track. Sum quantities per (card, board) so duplicate printings collapse to
        // one row and never collide on the (deck_id, card_id, board) primary key.
        val cards = sequenceOf(Board.MAINBOARD to detail.boards.mainboard, Board.SIDEBOARD to detail.boards.sideboard)
            .flatMap { (board, b) -> b.cards.values.asSequence().map { board to it } }
            .mapNotNull { (board, entry) ->
                nameToId[entry.card.name]?.let { cardId -> Triple(cardId, board, entry.quantity) }
            }
            .groupingBy { (cardId, board, _) -> cardId to board }
            .fold(0) { acc, (_, _, quantity) -> acc + quantity }
            .map { (key, quantity) -> DeckCard(key.first, quantity, key.second) }

        // The deck row was created (id-only) during discovery; reuse its surrogate id
        // so we update in place rather than violating the public_id unique constraint.
        val existingId = deckRepository.findByPublicId(publicId)?.id ?: 0
        val deck = Deck(
            id = existingId,
            publicId = detail.publicId,
            name = detail.name,
            author = detail.createdByUser.userName,
            colors = detail.colors.mapNotNull { code -> Color.entries.find { it.code == code } }.toTypedArray(),
            createdAt = OffsetDateTime.parse(detail.createdAtUtc),
            updatedAt = OffsetDateTime.parse(detail.lastUpdatedAtUtc),
            cards = cards,
        )
        deckRepository.save(deck)
        return true
    }

    @Transactional
    fun deleteByPublicId(publicId: String) {
        deckRepository.findByPublicId(publicId)?.let { deckRepository.delete(it) }
    }

    companion object {
        const val THREAD_COUNT = 50
    }
}
