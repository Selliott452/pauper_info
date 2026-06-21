package com.pauperinfo.card.repositories

import com.pauperinfo.card.CardLegality
import com.pauperinfo.card.CardLegalityId
import org.springframework.data.jpa.repository.JpaRepository

interface CardLegalityRepository : JpaRepository<CardLegality, CardLegalityId>