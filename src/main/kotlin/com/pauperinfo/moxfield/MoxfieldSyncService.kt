package com.pauperinfo.moxfield

import com.pauperinfo.card.repositories.CardRepository
import com.pauperinfo.deck.DeckPersistenceService
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

@Service
class MoxfieldSyncService(
    private val moxfieldClient: MoxfieldClient,
    private val deckPersistenceService: DeckPersistenceService,
    private val cardRepository: CardRepository
) {

    private val log = LoggerFactory.getLogger(MoxfieldSyncService::class.java)

    private val executor = Executors.newFixedThreadPool(MoxfieldClient.POOL_SIZE)

    @Async
    fun syncAllDecks() {
        val cards = cardRepository.findAll()
        log.info("Starting deck sync for ${cards.size} cards with ${MoxfieldClient.POOL_SIZE} workers")

        val completed = AtomicInteger(0)

        val futures = cards.map { card ->
            executor.submit {
                syncDecksForCard(card.name)
                val done = completed.incrementAndGet()
                if (done % 50 == 0) {
                    log.info("Progress: $done/${cards.size} cards synced")
                }
            }
        }

        futures.forEach { it.get() }

        log.info("Full deck sync complete")
    }

    fun syncDecksForCard(cardName: String) {
        var pageNumber = 1
        var totalPages: Int

        do {
            val response = moxfieldClient.searchDecks(cardName, pageNumber)
            totalPages = response.totalPages

            if (response.data.isNotEmpty()) {
                deckPersistenceService.saveNewDecks(response.data.map { it.publicId })
            }

            pageNumber++

            if (pageNumber <= totalPages) {
                Thread.sleep(500)
            }
        } while (pageNumber <= totalPages)
    }
}
