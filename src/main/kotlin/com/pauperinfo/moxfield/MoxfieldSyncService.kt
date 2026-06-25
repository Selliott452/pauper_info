package com.pauperinfo.moxfield

import com.pauperinfo.card.repositories.CardRepository
import com.pauperinfo.deck.DeckPersistenceService
import com.pauperinfo.deck.DeckRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

@Service
class MoxfieldSyncService(
    private val moxfieldClient: MoxfieldClient,
    private val deckPersistenceService: DeckPersistenceService,
    private val deckRepository: DeckRepository,
    private val cardRepository: CardRepository
) {

    private val log = LoggerFactory.getLogger(MoxfieldSyncService::class.java)

    private val executor = Executors.newFixedThreadPool(MoxfieldClient.POOL_SIZE)

    @Async
    fun syncAllDecks() {
        val cards = cardRepository.findAll()
        log.info("Starting deck sync for ${cards.size} cards with ${MoxfieldClient.POOL_SIZE} workers")

        // The same popular decks surface under many cards, so the vast majority of
        // discovered ids are already known. Load them once and filter in memory so
        // we don't fire (and lock-contend on) hundreds of thousands of redundant
        // inserts. Shared across workers; add() is the atomic "claim this id" guard.
        val knownPublicIds = ConcurrentHashMap.newKeySet<String>()
        knownPublicIds.addAll(deckRepository.findAllPublicIds())

        val completed = AtomicInteger(0)

        val futures = cards.map { card ->
            executor.submit {
                try {
                    syncDecksForCard(card.name, knownPublicIds)
                } catch (e: Exception) {
                    log.warn("Failed to sync decks for card ${card.name}: ${e.message}")
                }
                val done = completed.incrementAndGet()
                if (done % 50 == 0) {
                    log.info("Progress: $done/${cards.size} cards synced")
                }
            }
        }

        futures.forEach { it.get() }

        log.info("Full deck sync complete")
    }

    fun syncDecksForCard(cardName: String, knownPublicIds: MutableSet<String>) {
        var pageNumber = 1
        var totalPages: Int

        do {
            val response = moxfieldClient.searchDecks(cardName, pageNumber)
            totalPages = response.totalPages

            // Keep only ids we haven't seen before; add() returns true once per id,
            // atomically claiming it so two workers never both insert the same one.
            val fresh = response.data.map { it.publicId }.filter { knownPublicIds.add(it) }
            if (fresh.isNotEmpty()) {
                deckPersistenceService.saveNewDecks(fresh)
            }

            pageNumber++

            if (pageNumber <= totalPages) {
                Thread.sleep(500)
            }
        } while (pageNumber <= totalPages)
    }
}
