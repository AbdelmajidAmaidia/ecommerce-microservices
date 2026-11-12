package com.shop.payment.exception;

public class UnsupportedCurrencyException extends RuntimeException {
    public UnsupportedCurrencyException(String currency) {
        super("Currency " + currency + " is not supported by this payment service.");
    }
}
