package com.shop.payment.messaging;

import com.shop.payment.dto.PaymentSucceededEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaymentProducer {

    private static final Logger logger = LoggerFactory.getLogger(PaymentProducer.class);

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public PaymentProducer(
            RabbitTemplate rabbitTemplate,
            @Value("${payment.messaging.exchange:payment.exchange}") String exchange,
            @Value("${payment.messaging.routing-key:payment.succeeded}") String routingKey
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publish(PaymentSucceededEvent event) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            logger.info(
                    "Published PaymentSucceededEvent eventId={} paymentId={} orderId={} exchange={} routingKey={}",
                    event.eventId(), event.paymentId(), event.orderId(), exchange, routingKey
            );
        } catch (AmqpException exception) {
            logger.error(
                    "Could not publish PaymentSucceededEvent eventId={} paymentId={} orderId={}",
                    event.eventId(), event.paymentId(), event.orderId(), exception
            );
            throw exception;
        }
    }
}
