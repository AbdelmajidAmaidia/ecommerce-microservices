package com.shop.payment.exception;

public class OrderNotPayableException extends RuntimeException {
    public OrderNotPayableException(Long orderId, String status) {
        super("Order " + orderId + " cannot be paid while its status is " + status + ".");
    }
}
