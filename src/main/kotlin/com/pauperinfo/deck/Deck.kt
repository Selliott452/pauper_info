package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "deck", schema = "metagame")
class Deck(

    // Internal surrogate key (assigned by the database). 0 for a not-yet-persisted
    // deck. The API identifies decks by publicId, not this.
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    // Moxfield public id — the external identifier we fetch by and expose in the API.
    @Column(name = "public_id")
    val publicId: String,

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
    @CollectionTable(name = "deck_card", schema = "metagame", joinColumns = [JoinColumn(name = "deck_id")])
    val cards: List<DeckCard> = emptyList(),
)
