package com.shop.payment.client;

import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.OrderServiceUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.SocketTimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class RemoteOrderClientTest {

    private MockRestServiceServer server;
    private RemoteOrderClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new RemoteOrderClient(builder.baseUrl("http://localhost:8085").build());
    }

    @Test
    void getsOrderUsingOrderServiceResponseShape() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"id":42,"total_amount":37.25,"currency":"TND","status":"pending","items":[]}
                        """, MediaType.APPLICATION_JSON));

        var order = client.findOrder(42L).orElseThrow();

        assertEquals(42L, order.orderId());
        assertEquals(new BigDecimal("37.25"), order.amount());
        assertEquals("TND", order.currency());
        assertEquals("pending", order.status());
        server.verify();
    }

    @Test
    void treatsHttpNotFoundAsMissingOrder() {
        server.expect(requestTo("http://localhost:8085/api/orders/404"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertTrue(client.findOrder(404L).isEmpty());
        server.verify();
    }

    @Test
    void treatsUpstreamHttpFailureAsUnavailable() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThrows(OrderServiceUnavailableException.class, () -> client.findOrder(42L));
        server.verify();
    }

    @Test
    void treatsNetworkTimeoutAsUnavailable() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThrows(OrderServiceUnavailableException.class, () -> client.findOrder(42L));
        server.verify();
    }

    @Test
    void rejectsMalformedOrderResponse() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andRespond(withSuccess("{not-json}", MediaType.APPLICATION_JSON));

        assertThrows(InvalidOrderDataException.class, () -> client.findOrder(42L));
        server.verify();
    }

    @Test
    void rejectsEmptySuccessfulOrderResponse() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andRespond(withSuccess());

        assertThrows(InvalidOrderDataException.class, () -> client.findOrder(42L));
        server.verify();
    }

    @Test
    void treatsConnectionFailureAsUnavailable() {
        server.expect(requestTo("http://localhost:8085/api/orders/42"))
                .andRespond(withException(new IOException("connection refused")));

        assertThrows(OrderServiceUnavailableException.class, () -> client.findOrder(42L));
        server.verify();
    }
}
