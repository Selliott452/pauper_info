package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.Color
import java.util.UUID

// Force-graph data: top cards as nodes, co-occurrence edges as links.
data class CardGraph(

    val nodes: List<GraphNode>,

    val links: List<GraphLink>,
)

data class GraphNode(

    val id: UUID,

    val name: String,

    val colors: List<Color>,

    // Mainboard decks running this card (node size / importance).
    val deckCount: Long,
)

data class GraphLink(

    val source: UUID,

    val target: UUID,

    // Number of mainboard decks running both cards (edge weight).
    val value: Long,
)
