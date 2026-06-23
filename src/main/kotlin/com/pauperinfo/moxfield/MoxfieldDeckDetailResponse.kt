package com.pauperinfo.moxfield

import com.fasterxml.jackson.annotation.JsonProperty

data class MoxfieldDeckDetailResponse(

    @JsonProperty("publicId")
    val publicId: String,

    @JsonProperty("name")
    val name: String,

    @JsonProperty("createdByUser")
    val createdByUser: MoxfieldUser,

    @JsonProperty("createdAtUtc")
    val createdAtUtc: String,

    @JsonProperty("lastUpdatedAtUtc")
    val lastUpdatedAtUtc: String,

    @JsonProperty("colors")
    val colors: List<String> = emptyList(),

    @JsonProperty("boards")
    val boards: MoxfieldBoards,
)

data class MoxfieldUser(

    @JsonProperty("userName")
    val userName: String,
)

data class MoxfieldBoards(

    @JsonProperty("mainboard")
    val mainboard: MoxfieldBoard = MoxfieldBoard(),

    @JsonProperty("sideboard")
    val sideboard: MoxfieldBoard = MoxfieldBoard(),
)

data class MoxfieldBoard(

    @JsonProperty("cards")
    val cards: Map<String, MoxfieldBoardEntry> = emptyMap(),
)

data class MoxfieldBoardEntry(

    @JsonProperty("quantity")
    val quantity: Int,

    @JsonProperty("card")
    val card: MoxfieldCardRef,
)

data class MoxfieldCardRef(

    @JsonProperty("name")
    val name: String,

    @JsonProperty("legalities")
    val legalities: Map<String, String> = emptyMap(),

    @JsonProperty("type_line")
    val typeLine: String? = null,

    @JsonProperty("oracle_text")
    val oracleText: String? = null,
)
