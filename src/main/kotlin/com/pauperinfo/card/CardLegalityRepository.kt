package com.pauperinfo.card

import org.springframework.data.jpa.repository.JpaRepository

interface CardLegalityRepository : JpaRepository<CardLegality, CardLegalityId>
