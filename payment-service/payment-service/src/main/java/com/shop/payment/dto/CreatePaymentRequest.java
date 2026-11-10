package com.shop.payment.dto;

import com.shop.payment.enums.PaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreatePaymentRequest(
        @NotNull @Positive Long orderId,
        @NotNull PaymentMethod method,
        @NotBlank @Size(max = 100) String idempotencyKey
) {
}
