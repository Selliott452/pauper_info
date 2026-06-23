package com.pauperinfo.archetype

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable

// One row of a scraped archetype profile: how often a card appears in that
// archetype's maindecks on mtgdecks (inclusion as a 0..1 fraction).
@Entity
@Table(name = "archetype_card")
@IdClass(ArchetypeCardId::class)
class ArchetypeCard(

    @Id
    val archetype: String,

    @Id
    @Column(name = "card_name")
    val cardName: String,

    val inclusion: Float,
)

data class ArchetypeCardId(
    val archetype: String = "",
    val cardName: String = "",
) : Serializable
