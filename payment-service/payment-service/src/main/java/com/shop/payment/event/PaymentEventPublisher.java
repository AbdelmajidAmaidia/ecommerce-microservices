package com.shop.payment.event;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaymentEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public PaymentEventPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${rabbitmq.exchange}") String exchange,
            @Value("${rabbitmq.routing-key}") String routingKey
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publishPaymentSucceeded(PaymentSucceededEvent event) {
        rabbitTemplate.convertAndSend(exchange, routingKey, event);
    }
}
