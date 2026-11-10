package com.shop.payment.exception;

public class InvalidPaymentTransitionException extends RuntimeException {
    public InvalidPaymentTransitionException() {
        super("Only a pending payment can transition to SUCCEEDED or FAILED.");
    }
}
