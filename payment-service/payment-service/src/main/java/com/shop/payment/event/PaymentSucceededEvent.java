package com.shop.payment.event;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentSucceededEvent(
        Long orderId,
        String paymentId,
        BigDecimal amount,
        String currency,
        Instant occurredAt
) {
}
