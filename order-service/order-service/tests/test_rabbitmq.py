import json
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.messaging.rabbitmq import (
    PaymentConsumer,
    PaymentSucceededEvent,
    RabbitMqSettings,
    parse_event,
    process_payment_event,
)
from app.models.order import Order, OrderStatus
from app.schemas.order import OrderCreate
from app.services.orders import create_order


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine, sessionmaker(bind=engine, expire_on_commit=False)


def event(order_id: int = 1) -> PaymentSucceededEvent:
    return PaymentSucceededEvent.model_validate(
        {
            "eventId": "event-1",
            "paymentId": "payment-1",
            "orderId": order_id,
            "status": "SUCCEEDED",
            "occurredAt": "2026-01-01T00:00:00Z",
        }
    )


def test_parses_java_json_event():
    parsed = parse_event(json.dumps(event().model_dump(mode="json")).encode())

    assert parsed.orderId == 1
    assert parsed.status == "SUCCEEDED"


def test_confirms_existing_order_and_duplicate_is_idempotent():
    engine, session_factory = make_session()
    try:
        with session_factory() as db:
            order = create_order(
                db,
                OrderCreate(
                    customer_id=42,
                    items=[{"product_id": "book", "quantity": 1, "unit_price": "10.00"}],
                    currency="TND",
                ),
            )
            order_id = order.id

        with session_factory() as db:
            assert process_payment_event(db, event(order_id)) is True
            db.commit()
        with session_factory() as db:
            assert process_payment_event(db, event(order_id)) is True
            db.commit()
            assert db.get(Order, order_id).status == OrderStatus.CONFIRMED
    finally:
        engine.dispose()


def test_unknown_order_is_non_retryable():
    engine, session_factory = make_session()
    try:
        with session_factory() as db:
            assert process_payment_event(db, event(999)) is False
    finally:
        engine.dispose()


def test_invalid_message_is_acknowledged_without_requeue():
    channel = SimpleNamespace()
    channel.acks = []
    channel.basic_ack = lambda **kwargs: channel.acks.append(kwargs)
    consumer = PaymentConsumer(RabbitMqSettings(), lambda: None)

    consumer.on_message(
        channel,
        SimpleNamespace(delivery_tag=7),
        SimpleNamespace(headers=None),
        b'{"orderId": "not-an-integer"}',
    )

    assert channel.acks == [{"delivery_tag": 7}]
