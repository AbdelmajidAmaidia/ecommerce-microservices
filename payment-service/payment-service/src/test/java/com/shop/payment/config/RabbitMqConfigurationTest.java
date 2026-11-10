package com.shop.payment.config;

import com.shop.payment.event.PaymentEventPublisher;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class RabbitMqConfigurationTest {

    private final RabbitMqConfiguration configuration = new RabbitMqConfiguration();
    private final CachingConnectionFactory connectionFactory =
            new CachingConnectionFactory("localhost", 5672);

    @Test
    void configuresPaymentSucceededTopology() {
        TopicExchange exchange = configuration.paymentEventsExchange("payment.events");
        Queue queue = configuration.paymentSucceededQueue("order-service.payment-succeeded");
        Binding binding = configuration.paymentSucceededBinding(queue, exchange, "payment.succeeded");

        assertEquals("payment.events", exchange.getName());
        assertEquals("order-service.payment-succeeded", queue.getName());
        assertEquals("payment.succeeded", binding.getRoutingKey());
        assertEquals("payment.events", binding.getExchange());
    }

    @Test
    void configuresJsonRabbitTemplateAndPublisher() {
        Jackson2JsonMessageConverter converter = configuration.rabbitMessageConverter();
        RabbitTemplate template = configuration.rabbitTemplate(connectionFactory, converter);
        PaymentEventPublisher publisher = new PaymentEventPublisher(
                template, "payment.events", "payment.succeeded");

        assertNotNull(converter);
        assertEquals(converter, template.getMessageConverter());
        assertEquals("payment.events", ReflectionTestUtils.getField(publisher, "exchange"));
        assertEquals("payment.succeeded", ReflectionTestUtils.getField(publisher, "routingKey"));
    }

    @Test
    void configuresRabbitAdminWithoutConnectingDuringUnitTest() {
        RabbitAdmin admin = configuration.rabbitAdmin(connectionFactory);

        assertNotNull(admin);
    }
}
