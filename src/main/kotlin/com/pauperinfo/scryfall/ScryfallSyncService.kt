package com.pauperinfo.scryfall

import com.pauperinfo.card.*
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import java.net.URI
import java.util.UUID

@Service
class ScryfallSyncService(
    private val cardRepository: CardRepository,
    private val cardLegalityRepository: CardLegalityRepository
) {

    private val restClient = RestClient.builder()
        .defaultHeader("User-Agent", "pauper-info/1.0 (selliott452@gmail.com)")
        .defaultHeader("Accept", "application/json")
        .build()

    @Async
    fun sync() {
        var url: String? = "https://api.scryfall.com/cards/search?q=f%3Apauper&unique=cards"

        while (url != null) {
            val response = restClient.get()
                .uri(URI.create(url))
                .retrieve()
                .body(ScryfallSearchResponse::class.java)!!

            processPage(response.data)

            url = if (response.hasMore) response.nextPage else null

            if (url != null) Thread.sleep(500)
        }
    }

    private fun processPage(scryfallCards: List<ScryfallCard>) {
        val incoming = scryfallCards.map { it.toEntity() }
        val ids = incoming.map { it.id }

        val existingById: Map<UUID, Card> = cardRepository.findAllById(ids).associateBy { it.id }
        val existingLegalitiesByCardId: Map<UUID, Map<Format, LegalityStatus>> = cardLegalityRepository
            .findAllById(ids.flatMap { cardId ->
                Format.entries.map { format -> CardLegalityId(cardId, format) }
            })
            .groupBy { it.id.cardId }
            .mapValues { (_, legalities) -> legalities.associate { it.id.format to it.status } }

        val toInsert = mutableListOf<Card>()
        val legalityIdsToDelete = mutableListOf<CardLegalityId>()
        val legalitiesToInsert = mutableListOf<CardLegality>()

        incoming.forEach { card ->
            val existing = existingById[card.id]

            if (existing == null) {
                toInsert.add(card)
            } else {
                val incomingLegalities = card.legalities.associate { it.id.format to it.status }
                val existingLegalities = existingLegalitiesByCardId[card.id] ?: emptyMap()

                if (incomingLegalities != existingLegalities) {
                    legalityIdsToDelete += existingLegalities.keys.map { CardLegalityId(card.id, it) }
                    legalitiesToInsert += card.legalities.map {
                        CardLegality(CardLegalityId(existing.id, it.id.format), existing, it.status)
                    }
                }
            }
        }

        cardRepository.saveAll(toInsert)
        cardLegalityRepository.deleteAllById(legalityIdsToDelete)
        cardLegalityRepository.saveAll(legalitiesToInsert)
    }

    private fun ScryfallCard.toEntity(): Card {
        val card = Card(
            id = id,
            name = name,
            manaCost = manaCost,
            cmc = cmc,
            typeLine = typeLine,
            oracleText = oracleText,
            power = power,
            toughness = toughness,
            colors = (colors ?: emptyList()).mapNotNull { code -> Color.entries.find { it.code == code } }.toTypedArray(),
            rarity = runCatching { Rarity.valueOf(rarity.uppercase()) }.getOrDefault(Rarity.COMMON),
            setCode = set,
            imageUri = imageUris?.get("normal")
        )

        legalities.forEach { (formatStr, statusStr) ->
            val format = runCatching { Format.valueOf(formatStr.uppercase()) }.getOrNull() ?: return@forEach
            val status = runCatching { LegalityStatus.valueOf(statusStr.uppercase()) }.getOrNull() ?: return@forEach
            card.legalities.add(CardLegality(CardLegalityId(card.id, format), card, status))
        }

        return card
    }
}
