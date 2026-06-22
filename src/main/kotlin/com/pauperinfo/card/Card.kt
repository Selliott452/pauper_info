package com.pauperinfo.card

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.Rarity
import jakarta.persistence.*
import java.math.BigDecimal
import java.util.UUID

@Entity
@Table(name = "card")
class Card(
    @Id
    val id: UUID,

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
