package com.pauperinfo.scryfall

import com.fasterxml.jackson.annotation.JsonProperty
import java.math.BigDecimal
import java.util.UUID

data class ScryfallCard(
    val id: UUID,

    val name: String,

    @JsonProperty("mana_cost")
    val manaCost: String?,

    val cmc: BigDecimal,

    @JsonProperty("type_line")
    val typeLine: String,

    @JsonProperty("oracle_text")
    val oracleText: String?,

    val power: String?,

    val toughness: String?,

    val colors: List<String>?,

    val rarity: String,

    val set: String,

    @JsonProperty("image_uris")
    val imageUris: Map<String, String>?,

    val legalities: Map<String, String>
)
