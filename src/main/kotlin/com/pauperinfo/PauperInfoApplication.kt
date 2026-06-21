package com.pauperinfo

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync

@SpringBootApplication
@EnableAsync
class PauperInfoApplication

fun main(args: Array<String>) {
    runApplication<PauperInfoApplication>(*args)
}
