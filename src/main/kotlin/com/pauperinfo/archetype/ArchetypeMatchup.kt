package com.pauperinfo.archetype

import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable

// A head-to-head matchup win rate scraped from the mtgdecks winrates matrix:
// how often [archetype] beats [opponent], as an integer percent over [matches]
// recorded games. The special opponent "Overall" holds the archetype's aggregate
// win rate across all matchups (see ArchetypeScrapeService.OVERALL).
@Entity
@Table(name = "archetype_matchup", schema = "metagame")
@IdClass(ArchetypeMatchupId::class)
class ArchetypeMatchup(

    @Id
    val archetype: String,

    @Id
    val opponent: String,

    val winrate: Int,

    val matches: Int,
)

data class ArchetypeMatchupId(
    val archetype: String = "",
    val opponent: String = "",
) : Serializable
