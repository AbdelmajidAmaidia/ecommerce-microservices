package com.shop.payment.client;

import com.shop.payment.dto.OrderDetails;
import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.OrderServiceUnavailableException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.time.Duration;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "payment.order-client.mode", havingValue = "remote")
public class RemoteOrderClient implements OrderClient {

    private final RestClient restClient;

    @Autowired
    public RemoteOrderClient(
            RestClient.Builder builder,
            @Value("${payment.order-client.base-url}") String baseUrl,
            @Value("${payment.order-client.connect-timeout:2s}") Duration connectTimeout,
            @Value("${payment.order-client.read-timeout:3s}") Duration readTimeout
    ) {
        this(buildRestClient(builder, baseUrl, connectTimeout, readTimeout));
    }

    private static RestClient buildRestClient(
            RestClient.Builder builder, String baseUrl, Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return builder.baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    RemoteOrderClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public Optional<OrderDetails> findOrder(Long orderId) {
        try {
            OrderDetails order = restClient.get()
                    .uri("/api/orders/{orderId}", orderId)
                    .retrieve()
                    .body(OrderDetails.class);
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
