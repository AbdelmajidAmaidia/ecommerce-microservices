package com.ecommerce.apigateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import reactor.core.publisher.Mono;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false"
})
class GatewayRoutesTest {

    @Autowired
    private RouteLocator routeLocator;

    @Test
    void routesUseEurekaServiceIdsAndPreserveRequestPaths() {
        List<Route> routes = routeLocator.getRoutes().collectList().block();
        assertNotNull(routes);
        Map<String, Route> routesById = routes.stream()
                .collect(Collectors.toMap(Route::getId, route -> route));

        assertEquals(2, routesById.size());
        assertRoute(routesById.get("order-service"), "lb://ORDER-SERVICE",
                "/api/orders/123", "/api/payments/123");
        assertRoute(routesById.get("payment-service"), "lb://PAYMENT-SERVICE",
                "/api/payments/456", "/api/orders/456");
    }

    private void assertRoute(Route route, String expectedUri, String matchingPath, String nonMatchingPath) {
        assertNotNull(route);
        assertEquals(URI.create(expectedUri), route.getUri());
        assertTrue(route.getFilters().isEmpty(), "Routes must not rewrite or strip request paths");
        assertTrue(matches(route, matchingPath));
        assertFalse(matches(route, nonMatchingPath));
    }

    private boolean matches(Route route, String path) {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get(path).build());
        return Mono.from(route.getPredicate().apply(exchange)).block();
    }
}
