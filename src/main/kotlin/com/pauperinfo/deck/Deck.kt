package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "deck")
class Deck(

    @Id
    val id: String,

    val name: String? = null,

    val author: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "TEXT[]")
    val colors: Array<Color>? = null,

    @Column(name = "created_at")
    val createdAt: OffsetDateTime? = null,

    @Column(name = "updated_at")
    val updatedAt: OffsetDateTime? = null,

    @ElementCollection
    @CollectionTable(name = "deck_card", joinColumns = [JoinColumn(name = "deck_id")])
    val cards: List<DeckCard> = emptyList(),
)
