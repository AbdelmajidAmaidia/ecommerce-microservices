package com.shop.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.payment.client.OrderClient;
import com.shop.payment.dto.CreatePaymentRequest;
import com.shop.payment.dto.UpdatePaymentStatusRequest;
import com.shop.payment.dto.OrderDetails;
import com.shop.payment.entity.Payment;
import com.shop.payment.enums.PaymentMethod;
import com.shop.payment.enums.PaymentStatus;
import com.shop.payment.exception.OrderServiceUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.shop.payment.messaging.PaymentProducer;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.DockerClientFactory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentControllerIntegrationTest {

    private static final MongoDBContainer MONGO;
    private static final String MONGODB_URI;

    static {
        String testMongoUri = System.getenv("PAYMENT_TEST_MONGODB_URI");
        if (testMongoUri != null && !testMongoUri.isBlank()) {
            MONGO = null;
            MONGODB_URI = testMongoUri;
        } else if (DockerClientFactory.instance().isDockerAvailable()) {
            MONGO = new MongoDBContainer("mongo:7.0.14");
            MONGO.start();
            MONGODB_URI = MONGO.getReplicaSetUrl();
        } else {
            MONGO = null;
            MONGODB_URI = "mongodb://localhost:27017/payment_test_db";
        }
    }

    @DynamicPropertySource
    static void configureMongo(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> MONGODB_URI);
    }

    @AfterAll
    static void stopMongoContainer() {
        if (MONGO != null) {
            MONGO.stop();
        }
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private MongoTemplate mongoTemplate;
    @MockitoBean
    private OrderClient orderClient;
    @MockitoBean
    private PaymentProducer paymentProducer;

    @BeforeEach
    void configureDemoOrders() {
        mongoTemplate.remove(new Query(), Payment.class);
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, new BigDecimal("49.99"), "TND")));
        when(orderClient.findOrder(1002L))
                .thenReturn(Optional.of(new OrderDetails(1002L, new BigDecimal("49.99"), "TND")));
        when(orderClient.findOrder(9999L)).thenReturn(Optional.empty());
    }

    @Test
    void createsSuccessfulPaymentAndReplaysIdempotentRequest() throws Exception {
        String body = objectMapper.writeValueAsString(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "integration-success"));

        String response = mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("SUCCEEDED")))
                .andExpect(jsonPath("$.amount", is(49.99)))
                .andExpect(jsonPath("$.currency", is("TND")))
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(response).get("id").asText();
        mockMvc.perform(get("/api/payments/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(id)))
                .andExpect(jsonPath("$.orderId", is(1001)));

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("SUCCEEDED")));
    }

    @Test
    void createsDeterministicallyDeclinedPayment() throws Exception {
        String body = objectMapper.writeValueAsString(
                new CreatePaymentRequest(1002L, PaymentMethod.SIMULATED_CARD, "integration-declined"));

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("FAILED")));
    }

    @Test
    void rejectsInvalidCreateRequestWithStructuredError() throws Exception {
        String body = """
                {"orderId":-1,"method":"SIMULATED_CARD","idempotencyKey":""}
                """;

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.details.orderId").exists())
                .andExpect(jsonPath("$.path", is("/api/payments")));
    }

    @Test
    void rejectsUnknownOrderAndUnknownPayment() throws Exception {
        String body = objectMapper.writeValueAsString(
                new CreatePaymentRequest(9999L, PaymentMethod.SIMULATED_CARD, "unknown-order"));

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("Not Found")));

        mockMvc.perform(get("/api/payments/65a1b2c3d4e5f60718293a4b"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.path", is("/api/payments/65a1b2c3d4e5f60718293a4b")));
    }

    @Test
    void returnsStructuredServiceUnavailableWhenOrderServiceFails() throws Exception {
        doThrow(new OrderServiceUnavailableException("connection failed", new RuntimeException()))
                .when(orderClient).findOrder(1010L);
        String body = objectMapper.writeValueAsString(
                new CreatePaymentRequest(1010L, PaymentMethod.SIMULATED_CARD, "order-service-down"));

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status", is(503)))
                .andExpect(jsonPath("$.message", is("The order service is temporarily unavailable.")));
    }

    @Test
    void filtersAndPaginatesPaymentsByOrder() throws Exception {
        createPayment(1001L, PaymentMethod.SIMULATED_CARD, "filter-one");
        createPayment(1002L, PaymentMethod.SIMULATED_CARD, "filter-two");

        mockMvc.perform(get("/api/payments")
                        .param("orderId", "1001")
                        .param("status", "SUCCEEDED")
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(1)))
                .andExpect(jsonPath("$.content[0].orderId", is(1001)));
    }

    @Test
    void usesObjectIdStringsAndCreatesUniquePartialIdempotencyIndex() throws Exception {
        createPayment(1001L, PaymentMethod.SIMULATED_CARD, "index-check");

        mockMvc.perform(get("/api/payments")
                        .param("orderId", "1001")
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(org.hamcrest.Matchers.matchesPattern("[a-fA-F0-9]{24}")));

        List<IndexInfo> indexes = mongoTemplate.indexOps(Payment.class).getIndexInfo();
        assertTrue(indexes.stream().anyMatch(index ->
                index.isUnique() && index.getName().equals("uk_payment_idempotency_key")));
        assertThrows(org.springframework.dao.DuplicateKeyException.class, () -> mongoTemplate.insert(
                new Payment(1001L, new BigDecimal("49.99"), "TND", PaymentMethod.SIMULATED_CARD,
                        PaymentStatus.SUCCEEDED, "index-check")));
    }

    @Test
    void rejectsReusingIdempotencyKeyForAnotherPayment() throws Exception {
        createPayment(1001L, PaymentMethod.SIMULATED_CARD, "conflict-key");
        String body = objectMapper.writeValueAsString(
                new CreatePaymentRequest(1001L, PaymentMethod.CASH_ON_DELIVERY, "conflict-key"));

        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)));
    }

    @Test
    void onlyPendingPaymentsCanBeFinalized() throws Exception {
        String createBody = objectMapper.writeValueAsString(
                new CreatePaymentRequest(1001L, PaymentMethod.CASH_ON_DELIVERY, "pending-status"));
        String createResponse = mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(createResponse).get("id").asText();

        String updateBody = objectMapper.writeValueAsString(new UpdatePaymentStatusRequest(PaymentStatus.SUCCEEDED));
        mockMvc.perform(patch("/api/payments/{id}/status", id)
                        .contentType(MediaType.APPLICATION_JSON).content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCEEDED")));

        String invalidRepeat = objectMapper.writeValueAsString(new UpdatePaymentStatusRequest(PaymentStatus.FAILED));
        mockMvc.perform(patch("/api/payments/{id}/status", id)
                        .contentType(MediaType.APPLICATION_JSON).content(invalidRepeat))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)));
    }

    private void createPayment(Long orderId, PaymentMethod method, String key) throws Exception {
        String body = objectMapper.writeValueAsString(new CreatePaymentRequest(orderId, method, key));
        mockMvc.perform(post("/api/payments").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }
}
