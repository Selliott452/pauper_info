package com.pauperinfo.tournament

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/competitors")
class CompetitorController(private val competitorService: CompetitorService) {

    @GetMapping
    fun list(): List<CompetitorSummary> = competitorService.list()

    @PostMapping
    fun create(@RequestBody request: CreateCompetitorRequest): Competitor = competitorService.create(request)

    @GetMapping("/{id}")
    fun detail(@PathVariable id: Int): CompetitorDetail = competitorService.get(id)
}
