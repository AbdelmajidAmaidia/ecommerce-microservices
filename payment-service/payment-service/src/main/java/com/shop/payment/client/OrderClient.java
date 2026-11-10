package com.shop.payment.client;

import com.shop.payment.dto.OrderDetails;

import java.util.Optional;

public interface OrderClient {
    Optional<OrderDetails> findOrder(Long orderId);
}
