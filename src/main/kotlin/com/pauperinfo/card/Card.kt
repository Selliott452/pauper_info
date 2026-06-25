package com.pauperinfo.card

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.Rarity
import jakarta.persistence.*
import java.math.BigDecimal
import java.util.UUID

@Entity
@Table(name = "card", schema = "metagame")
class Card(
    // Internal surrogate key (assigned by the database). 0 for a not-yet-persisted
    // card. The API identifies cards by scryfallId, not this.
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "card_id_seq")
    @SequenceGenerator(name = "card_id_seq", schema = "metagame", sequenceName = "card_id_seq", allocationSize = 50)
    val id: Int = 0,

    // Scryfall id — the external identifier we expose in the API.
    @Column(name = "scryfall_id")
    val scryfallId: UUID,

    val name: String,

    val manaCost: String?,

    val cmc: BigDecimal,

    val typeLine: String,

    val oracleText: String?,

    val power: String?,

    val toughness: String?,

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "TEXT[]")
    val colors: Array<Color>,

    @Enumerated(EnumType.STRING)
    val rarity: Rarity,

    val setCode: String,

    val imageUri: String?,

    val backImageUri: String?,

    @OneToMany(mappedBy = "card", cascade = [CascadeType.ALL], orphanRemoval = true)
    val legalities: MutableList<CardLegality> = mutableListOf()
)
