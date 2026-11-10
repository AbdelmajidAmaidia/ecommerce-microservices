package com.shop.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record OrderDetails(
        @JsonProperty("id") Long orderId,
        @JsonProperty("total_amount") BigDecimal amount,
        String currency,
        String status
) {
    public OrderDetails(Long orderId, BigDecimal amount, String currency) {
        this(orderId, amount, currency, "pending");
    }
}
