package com.shop.payment.service;

import com.shop.payment.enums.PaymentMethod;
import com.shop.payment.enums.PaymentStatus;

public interface PaymentSimulator {
    PaymentStatus simulate(Long orderId, PaymentMethod method);
}
