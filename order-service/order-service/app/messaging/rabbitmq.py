import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

import pika
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services.orders import (
    InvalidOrderTransitionError,
    OrderNotFoundError,
    confirm_payment,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RabbitMqSettings:
    host: str = os.getenv("RABBITMQ_HOST", "localhost")
    port: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    username: str = os.getenv("RABBITMQ_USERNAME", "")
    password: str = os.getenv("RABBITMQ_PASSWORD", "")
    virtual_host: str = os.getenv("RABBITMQ_VIRTUAL_HOST", "/")
    exchange: str = os.getenv("RABBITMQ_PAYMENT_EXCHANGE", "payment.exchange")
    queue: str = os.getenv("RABBITMQ_PAYMENT_QUEUE", "payment.succeeded.queue")
    routing_key: str = os.getenv(
        "RABBITMQ_PAYMENT_ROUTING_KEY", "payment.succeeded"
    )
    max_retries: int = int(os.getenv("RABBITMQ_MAX_RETRIES", "3"))


class PaymentSucceededEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventId: str
    paymentId: str | None = None
    orderId: int
    status: str
    occurredAt: datetime


def connection_parameters(settings: RabbitMqSettings) -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(settings.username, settings.password)
    return pika.ConnectionParameters(
        host=settings.host,
        port=settings.port,
        virtual_host=settings.virtual_host,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )


def declare_topology(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    settings: RabbitMqSettings,
) -> None:
    channel.exchange_declare(
        exchange=settings.exchange, exchange_type="direct", durable=True
    )
    channel.queue_declare(queue=settings.queue, durable=True)
    channel.queue_bind(
        exchange=settings.exchange,
        queue=settings.queue,
        routing_key=settings.routing_key,
    )


def process_payment_event(
    db: Session,
    event: PaymentSucceededEvent,
) -> bool:
    if event.status != "SUCCEEDED":
        raise ValueError(f"Unsupported payment event status: {event.status}")

    try:
        order = confirm_payment(db, order_id=event.orderId)
    except OrderNotFoundError:
        logger.warning(
            "Ignoring PaymentSucceededEvent eventId=%s: orderId=%s does not exist",
            event.eventId,
            event.orderId,
        )
        return False
    except InvalidOrderTransitionError:
        logger.warning(
            "Ignoring PaymentSucceededEvent eventId=%s: orderId=%s is not payable in its current state",
            event.eventId,
            event.orderId,
        )
        return False

    logger.info(
        "Processed PaymentSucceededEvent eventId=%s paymentId=%s orderId=%s status=%s",
        event.eventId,
        event.paymentId,
        order.id,
        order.status.value,
    )
    return True


def parse_event(body: bytes) -> PaymentSucceededEvent:
    payload = json.loads(body.decode("utf-8"))
    return PaymentSucceededEvent.model_validate(payload)


class PaymentConsumer:
    def __init__(
        self,
        settings: RabbitMqSettings | None = None,
        session_factory: Callable[[], Session] = SessionLocal,
    ) -> None:
        self.settings = settings or RabbitMqSettings()
        self.session_factory = session_factory

    def on_message(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        method: pika.spec.Basic.Deliver,
        properties: pika.BasicProperties,
        body: bytes,
    ) -> None:
        try:
            event = parse_event(body)
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError, ValueError):
            logger.exception(
                "Rejecting invalid payment event deliveryTag=%s", method.delivery_tag
            )
            channel.basic_ack(delivery_tag=method.delivery_tag)
            return

        db = self.session_factory()
        try:
            process_payment_event(db, event)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            retry_count = int((properties.headers or {}).get("x-retry-count", 0))
            if retry_count < self.settings.max_retries:
                headers = {"x-retry-count": retry_count + 1}
                channel.basic_publish(
                    exchange=self.settings.exchange,
                    routing_key=self.settings.routing_key,
                    body=body,
                    properties=pika.BasicProperties(
                        content_type="application/json", headers=headers
                    ),
                )
                channel.basic_ack(delivery_tag=method.delivery_tag)
                logger.exception(
                    "Temporarily failed deliveryTag=%s; scheduled retry %s/%s",
                    method.delivery_tag,
                    retry_count + 1,
                    self.settings.max_retries,
                )
            else:
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                logger.exception(
                    "Rejecting deliveryTag=%s after %s retries",
                    method.delivery_tag,
                    retry_count,
                )
        except (InvalidOrderTransitionError, ValueError):
            db.rollback()
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.exception(
                "Acknowledged non-retryable payment event deliveryTag=%s",
                method.delivery_tag,
            )
        finally:
            db.close()

    def run(self) -> None:
        connection = pika.BlockingConnection(connection_parameters(self.settings))
        try:
            channel = connection.channel()
            declare_topology(channel, self.settings)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(
                queue=self.settings.queue, on_message_callback=self.on_message
            )
            logger.info(
                "Listening for payment events queue=%s exchange=%s routingKey=%s",
                self.settings.queue,
                self.settings.exchange,
                self.settings.routing_key,
            )
            channel.start_consuming()
        finally:
            if connection.is_open:
                connection.close()
