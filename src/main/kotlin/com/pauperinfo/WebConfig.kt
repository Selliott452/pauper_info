package com.pauperinfo

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.method.HandlerTypePredicate
import org.springframework.web.servlet.config.annotation.CorsRegistry
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

// Prefixes every @RestController with /api so the API owns the /api namespace.
// Also allows cross-origin calls from the deployed SPA (GitHub Pages), whose
// origin(s) are configured via app.cors.allowed-origins (comma-separated).
@Configuration
class WebConfig(
    @Value("\${app.cors.allowed-origins:}") private val allowedOrigins: String,
) : WebMvcConfigurer {

    override fun configurePathMatch(configurer: PathMatchConfigurer) {
        configurer.addPathPrefix("/api", HandlerTypePredicate.forAnnotation(RestController::class.java))
    }

    override fun addCorsMappings(registry: CorsRegistry) {
        val origins = allowedOrigins.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        if (origins.isNotEmpty()) {
            registry.addMapping("/api/**")
                .allowedOrigins(*origins.toTypedArray())
                .allowedMethods("GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS")
                .allowedHeaders("*")
        }
    }
}
