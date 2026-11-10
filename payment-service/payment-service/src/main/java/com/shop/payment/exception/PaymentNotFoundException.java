package com.shop.payment.exception;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(String id) {
        super("Payment " + id + " was not found.");
    }
}
