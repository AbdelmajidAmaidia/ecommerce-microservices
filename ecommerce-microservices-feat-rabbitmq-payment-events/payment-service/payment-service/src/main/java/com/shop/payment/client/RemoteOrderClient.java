package com.shop.payment.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.payment.dto.OrderDetails;
import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.OrderServiceUnavailableException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "payment.order-client.mode", havingValue = "remote")
public class RemoteOrderClient implements OrderClient {

    private final RestClient restClient;
    private final boolean authEnabled;
    private final String tokenUrl;
    private final String clientId;
    private final String clientSecret;

    @Autowired
    public RemoteOrderClient(
            RestClient.Builder builder,
            @Value("${payment.order-client.base-url}") String baseUrl,
            @Value("${payment.order-client.connect-timeout:2s}") Duration connectTimeout,
            @Value("${payment.order-client.read-timeout:3s}") Duration readTimeout,
            @Value("${payment.order-client.auth.enabled:false}") boolean authEnabled,
            @Value("${payment.order-client.auth.token-url:}") String tokenUrl,
            @Value("${payment.order-client.auth.client-id:}") String clientId,
            @Value("${payment.order-client.auth.client-secret:}") String clientSecret
    ) {
        this(buildRestClient(builder, baseUrl, connectTimeout, readTimeout), authEnabled, tokenUrl, clientId, clientSecret);
    }

    private static RestClient buildRestClient(
            RestClient.Builder builder, String baseUrl, Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return builder.baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    RemoteOrderClient(RestClient restClient) {
        this(restClient, false, "", "", "");
    }

    RemoteOrderClient(RestClient restClient, boolean authEnabled, String tokenUrl, String clientId, String clientSecret) {
        this.restClient = restClient;
        this.authEnabled = authEnabled;
        this.tokenUrl = tokenUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    private String resolveBearerToken() {
        if (!authEnabled || tokenUrl == null || tokenUrl.isBlank() || clientId == null || clientId.isBlank()) {
            return null;
        }

        try {
            StringBuilder body = new StringBuilder();
            body.append("grant_type=").append(URLEncoder.encode("client_credentials", StandardCharsets.UTF_8));
            body.append("&client_id=").append(URLEncoder.encode(clientId, StandardCharsets.UTF_8));
            if (clientSecret != null && !clientSecret.isBlank()) {
                body.append("&client_secret=").append(URLEncoder.encode(clientSecret, StandardCharsets.UTF_8));
            }

            String payload = RestClient.create().post()
                    .uri(tokenUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body.toString())
                    .retrieve()
                    .body(String.class);

            Map<String, Object> tokenResponse = new ObjectMapper().readValue(payload, new TypeReference<>() {});
            return (String) tokenResponse.get("access_token");
        } catch (Exception exception) {
            throw new OrderServiceUnavailableException("Unable to acquire Keycloak access token for order-service.", exception);
        }
    }

    @Override
    public Optional<OrderDetails> findOrder(Long orderId) {
        try {
            var request = restClient.get()
                    .uri("/api/orders/{orderId}", orderId);
            String accessToken = resolveBearerToken();
            if (accessToken != null && !accessToken.isBlank()) {
                request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
            }

            OrderDetails order = request.retrieve().body(OrderDetails.class);
            if (order == null) {
                throw new InvalidOrderDataException();
            }
            return Optional.of(order);
        } catch (HttpClientErrorException.NotFound exception) {
            return Optional.empty();
        } catch (ResourceAccessException exception) {
            throw new OrderServiceUnavailableException("Unable to communicate with order-service.", exception);
        } catch (RestClientResponseException exception) {
            throw new OrderServiceUnavailableException(
                    "order-service returned HTTP status " + exception.getStatusCode() + ".", exception);
        } catch (HttpMessageConversionException exception) {
            throw new InvalidOrderDataException(exception);
        } catch (RestClientException exception) {
            throw new InvalidOrderDataException(exception);
        }
    }
}
