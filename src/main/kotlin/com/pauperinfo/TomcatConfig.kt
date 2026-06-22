package com.pauperinfo

import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Configuration

/**
 * Allows encoded slashes (%2F) in request paths so card names containing "//"
 * (e.g. split cards like "Fire // Ice") can be passed to /cards/{name}/statistics.
 */
@Configuration
class TomcatConfig : WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    override fun customize(factory: TomcatServletWebServerFactory) {
        factory.addConnectorCustomizers({ connector ->
            connector.encodedSolidusHandling = "passthrough"
        })
    }
}
