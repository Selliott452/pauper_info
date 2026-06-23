package com.pauperinfo.card.enums

/**
 * Parses a Postgres color array column (read via a native query) into [Color]s.
 *
 * Depending on the driver/path, an array column comes back as a [java.sql.Array],
 * a raw Kotlin/Java array, or its text representation ("{BLUE,WHITE}"). This
 * normalizes all three so native-query result rows can be mapped uniformly.
 */
object ColorColumn {

    fun parse(value: Any?): List<Color> = when (value) {
        null -> emptyList()
        is java.sql.Array -> (value.array as Array<*>).map { Color.valueOf(it as String) }
        is Array<*> -> value.map { Color.valueOf(it as String) }
        is String -> value.trim('{', '}')
            .split(',')
            .filter { it.isNotBlank() }
            .map { Color.valueOf(it.trim('"')) }
        else -> emptyList()
    }
}
