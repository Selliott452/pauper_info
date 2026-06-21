package com.pauperinfo.scryfall

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/scryfall")
class ScryfallController(private val scryfallSyncService: ScryfallSyncService) {

    @PostMapping("/sync")
    fun sync(): ResponseEntity<String> {
        scryfallSyncService.sync()
        return ResponseEntity.accepted().body("Sync started")
    }
}
