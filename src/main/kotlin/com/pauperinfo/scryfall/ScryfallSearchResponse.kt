package com.pauperinfo.scryfall

import com.fasterxml.jackson.annotation.JsonProperty

data class ScryfallSearchResponse(
    val data: List<ScryfallCard>,
    @JsonProperty("has_more") val hasMore: Boolean,
    @JsonProperty("next_page") val nextPage: String?
)
