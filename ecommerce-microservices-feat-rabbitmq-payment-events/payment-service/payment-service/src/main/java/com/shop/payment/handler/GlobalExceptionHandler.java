package com.shop.payment.handler;

import com.shop.payment.dto.ApiError;
import com.shop.payment.exception.IdempotencyConflictException;
import com.shop.payment.exception.InvalidOrderDataException;
import com.shop.payment.exception.InvalidPaymentTransitionException;
import com.shop.payment.exception.OrderNotFoundException;
import com.shop.payment.exception.OrderNotPayableException;
import com.shop.payment.exception.OrderServiceUnavailableException;
import com.shop.payment.exception.PaymentNotFoundException;
import com.shop.payment.exception.UnsupportedCurrencyException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import com.mongodb.MongoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        Map<String, String> details = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                details.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return error(HttpStatus.BAD_REQUEST, "Request validation failed.", request, details);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleConstraintViolation(
            ConstraintViolationException exception, HttpServletRequest request) {
        Map<String, String> details = new LinkedHashMap<>();
        exception.getConstraintViolations().forEach(violation ->
                details.put(violation.getPropertyPath().toString(), violation.getMessage()));
        return error(HttpStatus.BAD_REQUEST, "Request validation failed.", request, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleUnreadable(
            HttpMessageNotReadableException exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "Request body is invalid or contains an unsupported value.", request, Map.of());
    }

    @ExceptionHandler(PaymentNotFoundException.class)
    public org.springframework.http.ResponseEntity<ApiError> handlePaymentNotFound(
            PaymentNotFoundException exception, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleOrderNotFound(
            OrderNotFoundException exception, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler({IdempotencyConflictException.class, InvalidPaymentTransitionException.class,
            OrderNotPayableException.class})
    public org.springframework.http.ResponseEntity<ApiError> handleConflict(
            RuntimeException exception, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler({DataAccessException.class, MongoException.class})
    public org.springframework.http.ResponseEntity<ApiError> handleMongoUnavailable(
            RuntimeException exception, HttpServletRequest request) {
        LOGGER.error("MongoDB is unavailable while handling {}", request.getRequestURI(), exception);
        return error(HttpStatus.SERVICE_UNAVAILABLE,
                "The payment database is temporarily unavailable.", request, Map.of());
    }

    @ExceptionHandler(UnsupportedCurrencyException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleCurrency(
            UnsupportedCurrencyException exception, HttpServletRequest request) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(OrderServiceUnavailableException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleOrderService(
            OrderServiceUnavailableException exception, HttpServletRequest request) {
        return error(HttpStatus.SERVICE_UNAVAILABLE,
                "The order service is temporarily unavailable.", request, Map.of());
    }

    @ExceptionHandler(InvalidOrderDataException.class)
    public org.springframework.http.ResponseEntity<ApiError> handleInvalidOrderData(
            InvalidOrderDataException exception, HttpServletRequest request) {
        return error(HttpStatus.BAD_GATEWAY, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler(Exception.class)
    public org.springframework.http.ResponseEntity<ApiError> handleUnexpected(
            Exception exception, HttpServletRequest request) {
        LOGGER.error("Unexpected error while handling {}", request.getRequestURI(), exception);
        return error(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred.", request, Map.of());
    }

    private org.springframework.http.ResponseEntity<ApiError> error(
            HttpStatus status, String message, HttpServletRequest request, Map<String, String> details) {
        ApiError body = new ApiError(
                Instant.now(), status.value(), status.getReasonPhrase(), message, request.getRequestURI(), details);
        return org.springframework.http.ResponseEntity.status(status).body(body);
    }
}
