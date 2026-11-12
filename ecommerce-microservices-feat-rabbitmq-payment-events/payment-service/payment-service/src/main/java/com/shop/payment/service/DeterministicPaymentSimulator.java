package com.shop.payment.service;

import com.shop.payment.enums.PaymentMethod;
import com.shop.payment.enums.PaymentStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DeterministicPaymentSimulator implements PaymentSimulator {

    private final Set<Long> declinedOrderIds;

    public DeterministicPaymentSimulator(
            @Value("${payment.simulator.declined-order-ids:1002}") String declinedOrderIds
    ) {
        this.declinedOrderIds = Arrays.stream(declinedOrderIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public PaymentStatus simulate(Long orderId, PaymentMethod method) {
        if (method == PaymentMethod.CASH_ON_DELIVERY) {
            return PaymentStatus.PENDING;
        }
        return declinedOrderIds.contains(orderId) ? PaymentStatus.FAILED : PaymentStatus.SUCCEEDED;
    }
}
