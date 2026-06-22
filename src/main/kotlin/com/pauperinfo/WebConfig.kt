package com.pauperinfo

import org.springframework.context.annotation.Configuration
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.method.HandlerTypePredicate
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

// Prefixes every @RestController with /api so the API and the bundled SPA can
// share one origin: the API owns the /api namespace, the frontend owns everything
// else (/, /cards/:name, ...) for client-side routing.
@Configuration
class WebConfig : WebMvcConfigurer {

    override fun configurePathMatch(configurer: PathMatchConfigurer) {
        configurer.addPathPrefix("/api", HandlerTypePredicate.forAnnotation(RestController::class.java))
    }
}
