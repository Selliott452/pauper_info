package com.pauperinfo.card

import jakarta.persistence.*
import java.io.Serializable
import java.util.UUID

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
    val cardId: UUID,

    @Enumerated(EnumType.STRING)
    val format: Format
) : Serializable
