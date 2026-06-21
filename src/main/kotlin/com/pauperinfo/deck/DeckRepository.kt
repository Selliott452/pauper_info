package com.pauperinfo.deck

import org.springframework.data.jpa.repository.JpaRepository

interface DeckRepository : JpaRepository<Deck, String>
