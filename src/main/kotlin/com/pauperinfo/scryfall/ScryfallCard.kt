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

    @JsonProperty("card_faces")
    val cardFaces: List<ScryfallCardFace>?,

    val legalities: Map<String, String>
)

// Double-faced cards carry mana cost, oracle text, colors, and images per face.
data class ScryfallCardFace(

    @JsonProperty("mana_cost")
    val manaCost: String?,

    @JsonProperty("oracle_text")
    val oracleText: String?,

    val colors: List<String>?,

    @JsonProperty("image_uris")
    val imageUris: Map<String, String>?,
)
