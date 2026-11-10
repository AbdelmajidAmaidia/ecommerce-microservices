package com.shop.payment.entity;

import com.shop.payment.enums.PaymentMethod;
import com.shop.payment.enums.PaymentStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

@Document(collection = "payments")
public class Payment {

    @Id
    private String id;

    private Long orderId;

    private BigDecimal amount;

    private String currency;

    private PaymentMethod method;

    private PaymentStatus status;

    private Instant createdAt;

    private Instant updatedAt;

    @Indexed(name = "uk_payment_idempotency_key", unique = true,
            partialFilter = "{ 'idempotencyKey': { '$type': 'string' } }")
    private String idempotencyKey;

    protected Payment() {
    }

    public Payment(Long orderId, BigDecimal amount, String currency, PaymentMethod method,
                   PaymentStatus status, String idempotencyKey) {
        this.orderId = orderId;
        this.amount = amount;
        this.currency = currency;
        this.method = method;
        this.status = status;
        this.idempotencyKey = idempotencyKey;
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    public void transitionTo(PaymentStatus newStatus) {
        if (status != PaymentStatus.PENDING
                || (newStatus != PaymentStatus.SUCCEEDED && newStatus != PaymentStatus.FAILED)) {
            throw new IllegalStateException("Only a pending payment can be finalized.");
        }
        status = newStatus;
        updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public PaymentMethod getMethod() {
        return method;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }
}
