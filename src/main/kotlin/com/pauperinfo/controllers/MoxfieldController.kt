package com.pauperinfo.controllers

import com.pauperinfo.moxfield.MoxfieldDeckDetailSyncService
import com.pauperinfo.moxfield.MoxfieldSyncService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/moxfield")
class MoxfieldController(
    private val moxfieldSyncService: MoxfieldSyncService,
    private val moxfieldDeckDetailSyncService: MoxfieldDeckDetailSyncService,
) {

    @PostMapping("/sync-decks")
    fun syncDecks(
        @RequestParam cardName: String
    ): ResponseEntity<String> {

        moxfieldSyncService.syncDecksForCard(cardName)

        return ResponseEntity.accepted().body("Deck sync started for cardName=$cardName")
    }

    @PostMapping("/sync-all-decks")
    fun syncAllDecks(): ResponseEntity<String> {

        moxfieldSyncService.syncAllDecks()

        return ResponseEntity.accepted().body("Full deck sync started")
    }

    // all=true re-fetches and re-validates every deck (applies pauper legality).
    @PostMapping("/sync-deck-details")
    fun syncDeckDetails(@RequestParam(defaultValue = "false") all: Boolean): ResponseEntity<String> {
        moxfieldDeckDetailSyncService.syncDeckDetails(all)
        return ResponseEntity.accepted().body("Deck detail sync started (all=$all)")
    }
}
