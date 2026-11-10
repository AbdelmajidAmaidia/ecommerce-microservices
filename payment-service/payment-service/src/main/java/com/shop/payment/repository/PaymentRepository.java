package com.shop.payment.repository;

import com.shop.payment.entity.Payment;
import com.shop.payment.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PaymentRepository extends MongoRepository<Payment, String> {
    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    Page<Payment> findByOrderId(Long orderId, Pageable pageable);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    Page<Payment> findByOrderIdAndStatus(Long orderId, PaymentStatus status, Pageable pageable);
}
