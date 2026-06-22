package com.pauperinfo.moxfield

class DeckNotFoundException(publicId: String) : RuntimeException("Deck $publicId not found (404)")
