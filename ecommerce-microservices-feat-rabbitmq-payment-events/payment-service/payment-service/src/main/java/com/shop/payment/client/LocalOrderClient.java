package com.shop.payment.client;

import com.shop.payment.dto.OrderDetails;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(name = "payment.order-client.mode", havingValue = "local", matchIfMissing = true)
public class LocalOrderClient implements OrderClient {

    private final Set<Long> knownOrderIds;
    private final BigDecimal demoAmount;
    private final String demoCurrency;

    public LocalOrderClient(
            @Value("${payment.local-orders.ids:1001,1002}") String orderIds,
            @Value("${payment.local-orders.amount:49.99}") BigDecimal demoAmount,
            @Value("${payment.local-orders.currency:TND}") String demoCurrency
    ) {
        this.knownOrderIds = Arrays.stream(orderIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toUnmodifiableSet());
        this.demoAmount = demoAmount;
        this.demoCurrency = demoCurrency;
    }

    @Override
    public Optional<OrderDetails> findOrder(Long orderId) {
        if (!knownOrderIds.contains(orderId)) {
            return Optional.empty();
        }
        return Optional.of(new OrderDetails(orderId, demoAmount, demoCurrency));
    }
}
