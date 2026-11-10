package com.shop.payment.service;

import com.shop.payment.client.OrderClient;
import com.shop.payment.dto.CreatePaymentRequest;
import com.shop.payment.dto.OrderDetails;
import com.shop.payment.dto.PaymentResponse;
import com.shop.payment.entity.Payment;
import com.shop.payment.enums.PaymentStatus;
import com.shop.payment.exception.IdempotencyConflictException;
import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.InvalidPaymentTransitionException;
import com.shop.payment.exception.OrderNotFoundException;
import com.shop.payment.exception.OrderNotPayableException;
import com.shop.payment.exception.PaymentNotFoundException;
import com.shop.payment.exception.UnsupportedCurrencyException;
import com.shop.payment.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderClient orderClient;
    private final PaymentSimulator paymentSimulator;
    private final String supportedCurrency;

    public PaymentService(
            PaymentRepository paymentRepository,
            OrderClient orderClient,
            PaymentSimulator paymentSimulator,
            @Value("${payment.currency:TND}") String supportedCurrency
    ) {
        this.paymentRepository = paymentRepository;
        this.orderClient = orderClient;
        this.paymentSimulator = paymentSimulator;
        this.supportedCurrency = supportedCurrency.toUpperCase(Locale.ROOT);
    }

    public PaymentResponse create(CreatePaymentRequest request) {
        var existing = paymentRepository.findByIdempotencyKey(request.idempotencyKey());
        if (existing.isPresent()) {
            Payment payment = existing.get();
            if (!payment.getOrderId().equals(request.orderId()) || payment.getMethod() != request.method()) {
                throw new IdempotencyConflictException();
            }
            return PaymentResponse.from(payment);
        }

        OrderDetails order = orderClient.findOrder(request.orderId())
                .orElseThrow(() -> new OrderNotFoundException(request.orderId()));
        if (order.orderId() == null || !order.orderId().equals(request.orderId())
                || order.status() == null || order.status().isBlank()
                || order.amount() == null || order.amount().signum() <= 0
                || order.currency() == null || order.currency().isBlank()) {
            throw new InvalidOrderDataException();
        }
        if (!"pending".equalsIgnoreCase(order.status())) {
            throw new OrderNotPayableException(order.orderId(), order.status());
        }
        if (!supportedCurrency.equalsIgnoreCase(order.currency())) {
            throw new UnsupportedCurrencyException(order.currency());
        }

        Payment payment = new Payment(
                request.orderId(),
                order.amount(),
                order.currency().toUpperCase(Locale.ROOT),
                request.method(),
                paymentSimulator.simulate(request.orderId(), request.method()),
                request.idempotencyKey()
        );
        try {
            return PaymentResponse.from(paymentRepository.save(payment));
        } catch (DuplicateKeyException exception) {
            throw new IdempotencyConflictException();
        }
    }

    public Page<PaymentResponse> findAll(Long orderId, PaymentStatus status, Pageable pageable) {
        Page<Payment> payments;
        if (orderId != null && status != null) {
            payments = paymentRepository.findByOrderIdAndStatus(orderId, status, pageable);
        } else if (orderId != null) {
            payments = paymentRepository.findByOrderId(orderId, pageable);
        } else if (status != null) {
            payments = paymentRepository.findByStatus(status, pageable);
        } else {
            payments = paymentRepository.findAll(pageable);
        }
        return payments.map(PaymentResponse::from);
    }

    public PaymentResponse findById(String id) {
        return paymentRepository.findById(id)
                .map(PaymentResponse::from)
                .orElseThrow(() -> new PaymentNotFoundException(id));
    }

    public PaymentResponse updateStatus(String id, PaymentStatus status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new PaymentNotFoundException(id));
        try {
            payment.transitionTo(status);
        } catch (IllegalStateException exception) {
            throw new InvalidPaymentTransitionException();
        }
        return PaymentResponse.from(paymentRepository.save(payment));
    }
}
