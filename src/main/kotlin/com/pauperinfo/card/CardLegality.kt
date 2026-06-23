package com.pauperinfo.card

import com.pauperinfo.card.enums.Format
import com.pauperinfo.card.enums.LegalityStatus
import jakarta.persistence.*
import java.io.Serializable

@Entity
@Table(name = "card_legality")
class CardLegality(
    @EmbeddedId
    val id: CardLegalityId,

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("cardId")
    @JoinColumn(name = "card_id")
    val card: Card,

    @Enumerated(EnumType.STRING)
    val status: LegalityStatus
)

@Embeddable
data class CardLegalityId(
    // Surrogate card id (card.id).
    val cardId: Int,

    @Enumerated(EnumType.STRING)
    val format: Format
) : Serializable
