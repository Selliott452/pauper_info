package com.pauperinfo.deck

import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "deck")
class Deck(
    @Id
    val id: String
)
