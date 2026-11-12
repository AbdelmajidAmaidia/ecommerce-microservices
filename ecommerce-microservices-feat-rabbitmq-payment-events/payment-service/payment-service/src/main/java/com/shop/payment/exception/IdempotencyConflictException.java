package com.shop.payment.exception;

public class IdempotencyConflictException extends RuntimeException {
    public IdempotencyConflictException() {
        super("The idempotency key is already associated with a different payment request.");
    }
}
