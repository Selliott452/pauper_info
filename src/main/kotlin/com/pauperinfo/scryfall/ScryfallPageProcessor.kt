package com.pauperinfo.scryfall

import com.pauperinfo.card.*
import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.Format
import com.pauperinfo.card.enums.LegalityStatus
import com.pauperinfo.card.enums.Rarity
import com.pauperinfo.card.repositories.CardRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ScryfallPageProcessor(
    private val cardRepository: CardRepository
) {

    private val log = LoggerFactory.getLogger(ScryfallPageProcessor::class.java)

    @Transactional
    fun processPage(scryfallCards: List<ScryfallCard>) {
        val incoming = scryfallCards.map { it.toEntity() }

        // Cards are keyed on a surrogate id, so dedupe incoming rows against the
        // external Scryfall id (scryfall_id).
        val existingByScryfall = cardRepository
            .findByScryfallIdIn(incoming.map { it.scryfallId })
            .associateBy { it.scryfallId }

        val (newCards, existingCards) = incoming.partition { existingByScryfall[it.scryfallId] == null }

        cardRepository.saveAll(newCards)
        val updated = updateChangedLegalities(existingCards, existingByScryfall)

        log.info("Page processed: inserted=${newCards.size}, updated=$updated, unchanged=${existingCards.size - updated}")
    }

    /**
     * Re-syncs legality for cards we already have. We treat a card's legality map as
     * the only mutable thing about it (printings/oracle text don't change for an
     * existing Scryfall id), so for each existing card whose incoming legalities
     * differ from the stored ones, we replace the stored set. Returns how many were
     * updated. Keyed on the external Scryfall id (incoming cards aren't persisted, so
     * they have no surrogate id yet).
     */
    private fun updateChangedLegalities(
        cards: List<Card>,
        existingByScryfall: Map<UUID, Card>
    ): Int {
        val toUpdate = cards.filter { card ->
            val incomingLegalities = card.legalities.associate { it.id.format to it.status }
            val existingLegalities = existingByScryfall.getValue(card.scryfallId).legalities.associate { it.id.format to it.status }
            incomingLegalities != existingLegalities
        }

        toUpdate.forEach { card ->
            val existing = existingByScryfall.getValue(card.scryfallId)
            existing.legalities.clear()
            existing.legalities.addAll(
                card.legalities.map { CardLegality(CardLegalityId(existing.id, it.id.format), existing, it.status) }
            )
        }

        cardRepository.saveAll(toUpdate.map { existingByScryfall.getValue(it.scryfallId) })

        return toUpdate.size
    }

    private fun ScryfallCard.toEntity(): Card {
        val faces = cardFaces ?: emptyList()

        // Double-faced cards keep these per face; fall back to combining the faces.
        val resolvedManaCost = manaCost?.takeIf { it.isNotBlank() }
            ?: faces.mapNotNull { it.manaCost?.takeIf { c -> c.isNotBlank() } }
                .takeIf { it.isNotEmpty() }?.joinToString(" // ")
        val resolvedOracleText = oracleText
            ?: faces.mapNotNull { it.oracleText }.takeIf { it.isNotEmpty() }?.joinToString("\n//\n")
        val resolvedColors = (colors?.takeIf { it.isNotEmpty() }
            ?: faces.flatMap { it.colors ?: emptyList() }.distinct())
        val resolvedImageUri = imageUris?.get("normal")
            ?: faces.firstNotNullOfOrNull { it.imageUris?.get("normal") }
        // Back face image, only present on true double-faced cards (transform/MDFC).
        val resolvedBackImageUri = faces.getOrNull(1)?.imageUris?.get("normal")

        val card = Card(
            scryfallId = id,
            name = name,
            manaCost = resolvedManaCost,
            cmc = cmc,
            typeLine = typeLine,
            oracleText = resolvedOracleText,
            power = power,
            toughness = toughness,
            colors = resolvedColors.mapNotNull { code -> Color.entries.find { it.code == code } }.toTypedArray(),
            rarity = Rarity.entries.find { it.name == rarity.uppercase() } ?: Rarity.COMMON,
            setCode = set,
            imageUri = resolvedImageUri,
            backImageUri = resolvedBackImageUri
        )

        val cardLegalities = legalities.entries
            .mapNotNull { (formatStr, statusStr) ->
                val format = Format.entries.find { it.name == formatStr.uppercase() }
                val status = LegalityStatus.entries.find { it.name == statusStr.uppercase() }

                if (format != null && status != null) {
                    CardLegality(CardLegalityId(card.id, format), card, status)
                } else {
                    null
                }
            }

        card.legalities.addAll(cardLegalities)

        return card
    }
}
