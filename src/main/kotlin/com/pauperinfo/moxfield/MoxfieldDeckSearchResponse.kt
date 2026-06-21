package com.pauperinfo.moxfield

import com.fasterxml.jackson.annotation.JsonProperty

data class MoxfieldDeckSearchResponse(

    @JsonProperty("pageNumber")
    val pageNumber: Int,

    @JsonProperty("pageSize")
    val pageSize: Int,

    @JsonProperty("totalResults")
    val totalResults: Int,

    @JsonProperty("totalPages")
    val totalPages: Int,

    @JsonProperty("data")
    val data: List<MoxfieldDeckSummary>
)

data class MoxfieldDeckSummary(

    @JsonProperty("publicId")
    val publicId: String
)
