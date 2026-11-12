package com.shop.payment.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@ConditionalOnProperty(prefix = "keycloak", name = "enabled", havingValue = "true")
public class SecurityConfig {

    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${keycloak.realm-url:http://localhost:8180/realms/EcommerceRealm}") String realmUrl,
            @Value("${keycloak.client-id:ecommerce-api}") String clientId,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:http://localhost:8180/realms/EcommerceRealm/protocol/openid-connect/certs}") String jwkSetUri
    ) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(
                jwkSetUri
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

    @Bean
    public Converter<Jwt, List<GrantedAuthority>> keycloakGrantedAuthoritiesConverter() {
        return new Converter<Jwt, List<GrantedAuthority>>() {
            @Override
            public List<GrantedAuthority> convert(Jwt jwt) {
                Object realmAccess = jwt.getClaim("realm_access");
                if (!(realmAccess instanceof Map<?, ?> access)) {
                    return List.of();
                }
                Object roles = access.get("roles");
                if (!(roles instanceof List<?> roleList)) {
                    return List.of();
                }
                return roleList.stream()
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                        .toList();
            }
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   Converter<Jwt, List<GrantedAuthority>> keycloakGrantedAuthoritiesConverter) throws Exception {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthorityPrefix("ROLE_");
        authoritiesConverter.setAuthoritiesClaimName("realm_access.roles");

        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<GrantedAuthority> grantedAuthorities = keycloakGrantedAuthoritiesConverter.convert(jwt);
            return grantedAuthorities.isEmpty() ? authoritiesConverter.convert(jwt) : grantedAuthorities;
        });

        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(new AntPathRequestMatcher("/swagger-ui.html"),
                                new AntPathRequestMatcher("/swagger-ui/**"),
                                new AntPathRequestMatcher("/v3/api-docs/**"),
                                new AntPathRequestMatcher("/actuator/health"),
                                new AntPathRequestMatcher("/actuator/info")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/api/payments", "POST")).hasAnyRole("user", "admin")
                        .requestMatchers(new AntPathRequestMatcher("/api/payments", "GET")).hasAnyRole("user", "admin")
                        .requestMatchers(new AntPathRequestMatcher("/api/payments/**", "GET")).hasAnyRole("user", "admin")
                        .requestMatchers(new AntPathRequestMatcher("/api/payments/**", "PATCH")).hasRole("admin")
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));

        return http.build();
    }
}
