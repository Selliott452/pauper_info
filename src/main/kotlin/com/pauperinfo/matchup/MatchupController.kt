package com.pauperinfo.matchup

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/matchups")
class MatchupController(private val matchupService: MatchupService) {

    @GetMapping
    fun matchup(
        @RequestParam archetype: String,
        @RequestParam opponent: String,
        @RequestParam(defaultValue = "global") source: String,
    ): MatchupResult = matchupService.matchup(archetype, opponent, source)
}
