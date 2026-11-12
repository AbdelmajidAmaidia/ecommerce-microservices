package com.ecommerce.apigateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.server.SecurityWebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebFluxSecurity
@ConditionalOnProperty(prefix = "keycloak", name = "enabled", havingValue = "true")
public class SecurityConfig {

    @Bean
    public ReactiveJwtDecoder jwtDecoder(
            @Value("${keycloak.realm-url:http://localhost:8180/realms/EcommerceRealm}") String realmUrl,
            @Value("${keycloak.client-id:ecommerce-api}") String clientId
    ) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withJwkSetUri(
                realmUrl + "/protocol/openid-connect/certs"
        ).build();

        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                new JwtIssuerValidator(realmUrl),
                new JwtClaimValidator<>("aud", aud -> {
                    if (aud == null) {
                        return false;
                    }
                    if (aud instanceof List<?> values) {
                        return values.stream().anyMatch(value -> clientId.equals(value.toString()));
                    }
                    return clientId.equals(aud.toString());
                })
        );
        decoder.setJwtValidator(validator);
        return decoder;
    }

    private Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        return jwt -> {
            List<GrantedAuthority> authorities = List.of();
            Object realmAccess = jwt.getClaim("realm_access");
            if (realmAccess instanceof Map<?, ?> access) {
                Object roles = access.get("roles");
                if (roles instanceof List<?> roleList) {
                    authorities = roleList.stream()
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                            .toList();
                }
            }
            return Mono.just(new JwtAuthenticationToken(jwt, authorities, jwt.getSubject()));
        };
    }

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(
            ServerHttpSecurity http,
            ReactiveJwtDecoder jwtDecoder
    ) {
        Converter<Jwt, Mono<AbstractAuthenticationToken>> authenticationConverter =
                jwtAuthenticationConverter();

        http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers("/actuator/health", "/actuator/info").permitAll()
                        .pathMatchers("/api/**").hasAnyAuthority("ROLE_user", "ROLE_admin")
                        .anyExchange().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt
                                .jwtDecoder(jwtDecoder)
                                .jwtAuthenticationConverter(authenticationConverter)));

        return http.build();
    }
}
