package com.shop.payment.dto;

import com.shop.payment.enums.PaymentStatus;

import java.time.Instant;
import java.util.UUID;

public record PaymentSucceededEvent(
        String eventId,
        String paymentId,
        Long orderId,
        PaymentStatus status,
        Instant occurredAt
) {
    public static PaymentSucceededEvent from(String paymentId, Long orderId) {
        return new PaymentSucceededEvent(
                UUID.randomUUID().toString(),
                paymentId,
                orderId,
                PaymentStatus.SUCCEEDED,
                Instant.now()
        );
    }
}
