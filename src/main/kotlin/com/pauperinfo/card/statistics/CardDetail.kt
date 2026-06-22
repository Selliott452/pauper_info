package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.enums.Rarity
import java.math.BigDecimal
import java.util.UUID

// Full single-card view: card metadata joined with its play statistics.
data class CardDetail(

    val id: UUID,

    val name: String,

    val manaCost: String?,

    val cmc: BigDecimal,

    val typeLine: String,

    val oracleText: String?,

    val power: String?,

    val toughness: String?,

    val colors: List<Color>,

    val rarity: Rarity,

    val setCode: String,

    val imageUri: String?,

    val mainboardDeckCount: Long,

    val sideboardDeckCount: Long,

    val avgMainboardQuantity: Double?,

    val avgSideboardQuantity: Double?,

    val avgTotalQuantity: Double?,
)
