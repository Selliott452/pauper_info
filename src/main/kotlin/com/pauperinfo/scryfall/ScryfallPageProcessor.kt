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
        val ids = incoming.map { it.id }

        val existingById = cardRepository.findAllById(ids).associateBy { it.id }

        val (newCards, existingCards) = incoming.partition { existingById[it.id] == null }

        cardRepository.saveAll(newCards)
        val updated = updateChangedLegalities(existingCards, existingById)

        log.info("Page processed: inserted=${newCards.size}, updated=$updated, unchanged=${existingCards.size - updated}")
    }

    /**
     * Assuming that the only thing that can "change" about a card is it's legality
     * We save all new cards in processPage and then check if the legality status has changed
     * on any existing cards and if so propagate them.
     */
    private fun updateChangedLegalities(
        cards: List<Card>,
        existingById: Map<UUID, Card>
    ): Int {
        val toUpdate = cards.filter { card ->
            val incomingLegalities = card.legalities.associate { it.id.format to it.status }
            val existingLegalities = existingById[card.id]!!.legalities.associate { it.id.format to it.status }
            incomingLegalities != existingLegalities
        }

        toUpdate.forEach { card ->
            val existing = existingById[card.id]!!
            existing.legalities.clear()
            existing.legalities.addAll(
                card.legalities.map { CardLegality(CardLegalityId(existing.id, it.id.format), existing, it.status) }
            )
        }

        cardRepository.saveAll(toUpdate.map { existingById[it.id]!! })

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
            id = id,
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
