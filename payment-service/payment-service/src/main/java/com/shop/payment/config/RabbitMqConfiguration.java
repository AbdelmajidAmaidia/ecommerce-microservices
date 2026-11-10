package com.shop.payment.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfiguration {

    @Bean
    TopicExchange paymentEventsExchange(@Value("${rabbitmq.exchange}") String exchange) {
        return new TopicExchange(exchange, true, false);
    }

    @Bean
    Queue paymentSucceededQueue(@Value("${rabbitmq.queue}") String queue) {
        return new Queue(queue, true);
    }

    @Bean
    Binding paymentSucceededBinding(
            Queue paymentSucceededQueue,
            TopicExchange paymentEventsExchange,
            @Value("${rabbitmq.routing-key}") String routingKey
    ) {
        return BindingBuilder.bind(paymentSucceededQueue)
                .to(paymentEventsExchange)
                .with(routingKey);
    }

    @Bean
    RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        return new RabbitAdmin(connectionFactory);
    }

    @Bean
    Jackson2JsonMessageConverter rabbitMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter rabbitMessageConverter
    ) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(rabbitMessageConverter);
        return rabbitTemplate;
    }
}
