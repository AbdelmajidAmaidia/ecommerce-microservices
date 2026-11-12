package com.shop.payment.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shop.payment.dto.PaymentSucceededEvent;
import com.shop.payment.enums.PaymentStatus;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;

class PaymentProducerTest {

    @Test
    void publishesEventToConfiguredExchangeAndRoutingKey() {
        RabbitTemplate rabbitTemplate = org.mockito.Mockito.mock(RabbitTemplate.class);
        PaymentProducer producer = new PaymentProducer(rabbitTemplate, "payment.exchange", "payment.succeeded");
        PaymentSucceededEvent event = new PaymentSucceededEvent(
                "event-1", "payment-1", 42L, PaymentStatus.SUCCEEDED, Instant.parse("2026-01-01T00:00:00Z"));

        producer.publish(event);

        verify(rabbitTemplate).convertAndSend("payment.exchange", "payment.succeeded", event);
    }

    @Test
    void eventUsesJsonCompatibleFields() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        PaymentSucceededEvent event = new PaymentSucceededEvent(
                "event-1", "payment-1", 42L, PaymentStatus.SUCCEEDED, Instant.parse("2026-01-01T00:00:00Z"));

        String json = objectMapper.writeValueAsString(event);

        assertEquals("event-1", objectMapper.readTree(json).get("eventId").asText());
        assertEquals(42L, objectMapper.readTree(json).get("orderId").asLong());
        assertEquals("SUCCEEDED", objectMapper.readTree(json).get("status").asText());
    }
}
