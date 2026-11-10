from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

import pika

PAYMENT_SUCCEEDED_EVENT = "PaymentSucceededEvent"


@dataclass(frozen=True)
class RabbitMqSettings:
    host: str = "localhost"
    port: int = 5672
    username: str = "guest"
    password: str = "guest"
    virtual_host: str = "/"
    exchange: str = "payment.events"
    queue: str = "order-service.payment-succeeded"
    routing_key: str = "payment.succeeded"

    @classmethod
    def from_environment(cls) -> "RabbitMqSettings":
        return cls(
            host=os.getenv("RABBITMQ_HOST", cls.host),
            port=int(os.getenv("RABBITMQ_PORT", str(cls.port))),
            username=os.getenv("RABBITMQ_USERNAME", cls.username),
            password=os.getenv("RABBITMQ_PASSWORD", cls.password),
            virtual_host=os.getenv("RABBITMQ_VIRTUAL_HOST", cls.virtual_host),
            exchange=os.getenv("RABBITMQ_EXCHANGE", cls.exchange),
            queue=os.getenv("RABBITMQ_QUEUE", cls.queue),
            routing_key=os.getenv("RABBITMQ_ROUTING_KEY", cls.routing_key),
        )

    def connection_parameters(self) -> pika.ConnectionParameters:
        return pika.ConnectionParameters(
            host=self.host,
            port=self.port,
            virtual_host=self.virtual_host,
            credentials=pika.PlainCredentials(self.username, self.password),
        )


def create_connection(
    settings: RabbitMqSettings | None = None,
) -> pika.BlockingConnection:
    """Create a broker connection when messaging is explicitly used."""
    return pika.BlockingConnection(
        (settings or RabbitMqSettings.from_environment()).connection_parameters()
    )


class TopologyChannel(Protocol):
    def exchange_declare(self, *, exchange: str, exchange_type: str, durable: bool) -> object: ...

    def queue_declare(self, *, queue: str, durable: bool) -> object: ...

    def queue_bind(self, *, queue: str, exchange: str, routing_key: str) -> object: ...


def declare_topology(
    channel: TopologyChannel,
    settings: RabbitMqSettings | None = None,
) -> None:
    """Declare the shared payment event exchange, queue, and binding."""
    configuration = settings or RabbitMqSettings.from_environment()
    channel.exchange_declare(
        exchange=configuration.exchange,
        exchange_type="topic",
        durable=True,
    )
    channel.queue_declare(queue=configuration.queue, durable=True)
    channel.queue_bind(
        queue=configuration.queue,
        exchange=configuration.exchange,
        routing_key=configuration.routing_key,
    )
