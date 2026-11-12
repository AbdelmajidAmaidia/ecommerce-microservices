package com.shop.payment.dto;

import com.shop.payment.enums.PaymentStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePaymentStatusRequest(@NotNull PaymentStatus status) {
}
