package com.pauperinfo.card.repositories

import com.pauperinfo.card.Card
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CardRepository : JpaRepository<Card, UUID>