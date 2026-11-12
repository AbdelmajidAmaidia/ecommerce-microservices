package com.shop.payment.exception;

public class InvalidOrderDataException extends RuntimeException {
    public InvalidOrderDataException() {
        super("order-service returned invalid payment details.");
    }

    public InvalidOrderDataException(Throwable cause) {
        super("order-service returned an invalid response.", cause);
    }
}
