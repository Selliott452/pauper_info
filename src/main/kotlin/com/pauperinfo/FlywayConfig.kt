package com.pauperinfo

import org.flywaydb.core.Flyway
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class FlywayConfig(
    @Value("\${spring.datasource.url}") private val url: String,
    @Value("\${spring.datasource.username}") private val username: String,
    @Value("\${spring.datasource.password}") private val password: String,
) {

    @Bean(initMethod = "migrate")
    fun flyway(): Flyway = Flyway.configure()
        .dataSource(url, username, password)
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .load()
}
