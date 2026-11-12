package com.shop.payment.service;

import com.shop.payment.client.OrderClient;
import com.shop.payment.dto.CreatePaymentRequest;
import com.shop.payment.dto.OrderDetails;
import com.shop.payment.entity.Payment;
import com.shop.payment.enums.PaymentMethod;
import com.shop.payment.enums.PaymentStatus;
import com.shop.payment.exception.IdempotencyConflictException;
import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.InvalidPaymentTransitionException;
import com.shop.payment.exception.OrderNotFoundException;
import com.shop.payment.exception.OrderNotPayableException;
import com.shop.payment.exception.OrderServiceUnavailableException;
import com.shop.payment.exception.PaymentNotFoundException;
import com.shop.payment.exception.UnsupportedCurrencyException;
import com.shop.payment.messaging.PaymentProducer;
import com.shop.payment.repository.PaymentRepository;
import org.springframework.dao.DuplicateKeyException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private OrderClient orderClient;
    @Mock
    private PaymentSimulator simulator;
    @Mock
    private PaymentProducer paymentProducer;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(paymentRepository, orderClient, simulator, paymentProducer, "TND");
    }

    @Test
    void createsPaymentUsingOrderAmountAndSimulatorResult() {
        when(paymentRepository.findByIdempotencyKey("key-1")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, new BigDecimal("32.50"), "TND")));
        when(simulator.simulate(1001L, PaymentMethod.SIMULATED_CARD)).thenReturn(PaymentStatus.SUCCEEDED);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            return payment;
        });

        var response = paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key-1"));

        assertEquals(new BigDecimal("32.50"), response.amount());
        assertEquals(PaymentStatus.SUCCEEDED, response.status());
        verify(paymentProducer).publish(any());
    }

    @Test
    void rejectsMissingOrder() {
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(999L)).thenReturn(Optional.empty());

        assertThrows(OrderNotFoundException.class, () -> paymentService.create(
                new CreatePaymentRequest(999L, PaymentMethod.SIMULATED_CARD, "key")));
    }

    @Test
    void doesNotPublishDeclinedPayment() {
        when(paymentRepository.findByIdempotencyKey("declined-key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1002L))
                .thenReturn(Optional.of(new OrderDetails(1002L, BigDecimal.TEN, "TND")));
        when(simulator.simulate(1002L, PaymentMethod.SIMULATED_CARD)).thenReturn(PaymentStatus.FAILED);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        paymentService.create(
                new CreatePaymentRequest(1002L, PaymentMethod.SIMULATED_CARD, "declined-key"));

        verify(paymentProducer, never()).publish(any());
    }

    @Test
    void propagatesOrderServiceCommunicationFailure() {
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenThrow(new OrderServiceUnavailableException("connection failed", new RuntimeException()));

        assertThrows(OrderServiceUnavailableException.class, () -> paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key")));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void rejectsUnsupportedOrderCurrency() {
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, BigDecimal.TEN, "EUR")));

        assertThrows(UnsupportedCurrencyException.class, () -> paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key")));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void rejectsInvalidOrderAmount() {
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, BigDecimal.ZERO, "TND")));

        assertThrows(InvalidOrderDataException.class, () -> paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key")));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void rejectsOrdersThatAreNotPending() {
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, BigDecimal.TEN, "TND", "confirmed")));

        assertThrows(OrderNotPayableException.class, () -> paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key")));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void replaysSameIdempotencyKeyForSameOperation() {
        Payment existing = new Payment(1001L, BigDecimal.TEN, "TND", PaymentMethod.SIMULATED_CARD,
                PaymentStatus.SUCCEEDED, "key");
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.of(existing));

        var response = paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "key"));

        assertEquals(PaymentStatus.SUCCEEDED, response.status());
        verify(orderClient, never()).findOrder(1001L);
    }

    @Test
    void rejectsIdempotencyKeyUsedForDifferentOperation() {
        Payment existing = new Payment(1001L, BigDecimal.TEN, "TND", PaymentMethod.SIMULATED_CARD,
                PaymentStatus.SUCCEEDED, "key");
        when(paymentRepository.findByIdempotencyKey("key")).thenReturn(Optional.of(existing));

        assertThrows(IdempotencyConflictException.class, () -> paymentService.create(
                new CreatePaymentRequest(1002L, PaymentMethod.SIMULATED_CARD, "key")));
    }

    @Test
    void rejectsTransitionFromFinalizedPayment() {
        Payment finalized = new Payment(1001L, BigDecimal.TEN, "TND", PaymentMethod.SIMULATED_CARD,
                PaymentStatus.SUCCEEDED, "key");
        when(paymentRepository.findById("65a1b2c3d4e5f60718293a4b")).thenReturn(Optional.of(finalized));

        assertThrows(InvalidPaymentTransitionException.class,
                () -> paymentService.updateStatus("65a1b2c3d4e5f60718293a4b", PaymentStatus.FAILED));
    }

    @Test
    void reportsMissingPayment() {
        when(paymentRepository.findById("65a1b2c3d4e5f60718293a4b")).thenReturn(Optional.empty());

        assertThrows(PaymentNotFoundException.class,
                () -> paymentService.findById("65a1b2c3d4e5f60718293a4b"));
    }

    @Test
    void convertsMongoDuplicateKeyToIdempotencyConflict() {
        when(paymentRepository.findByIdempotencyKey("race-key")).thenReturn(Optional.empty());
        when(orderClient.findOrder(1001L))
                .thenReturn(Optional.of(new OrderDetails(1001L, BigDecimal.TEN, "TND")));
        when(simulator.simulate(1001L, PaymentMethod.SIMULATED_CARD)).thenReturn(PaymentStatus.SUCCEEDED);
        when(paymentRepository.save(any(Payment.class))).thenThrow(new DuplicateKeyException("duplicate key"));

        assertThrows(IdempotencyConflictException.class, () -> paymentService.create(
                new CreatePaymentRequest(1001L, PaymentMethod.SIMULATED_CARD, "race-key")));
    }
}
