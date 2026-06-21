package com.pauperinfo.moxfield

import com.pauperinfo.card.repositories.CardRepository
import com.pauperinfo.deck.DeckPersistenceService
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service

@Service
class MoxfieldSyncService(
    private val moxfieldClient: MoxfieldClient,
    private val deckPersistenceService: DeckPersistenceService,
    private val cardRepository: CardRepository
) {

    private val log = LoggerFactory.getLogger(MoxfieldSyncService::class.java)

    @Async
    fun syncAllDecks() {
        val cards = cardRepository.findAll()
        log.info("Starting deck sync for ${cards.size} cards")

        cards.forEachIndexed { index, card ->
            log.info("Syncing decks for card ${index + 1}/${cards.size}: ${card.name}")
            syncDecksForCard(card.name)
        }

        log.info("Full deck sync complete")
    }

    fun syncDecksForCard(cardName: String) {
        var pageNumber = 1
        var totalPages: Int

        do {
            val response = moxfieldClient.searchDecks(cardName, pageNumber)
            totalPages = response.totalPages

            deckPersistenceService.saveNewDecks(response.data.map { it.publicId })

            log.info("  Page $pageNumber/$totalPages — found ${response.data.size} decks")

            pageNumber++

            if (pageNumber <= totalPages) {
                Thread.sleep(500)
            }
        } while (pageNumber <= totalPages)
    }
}
