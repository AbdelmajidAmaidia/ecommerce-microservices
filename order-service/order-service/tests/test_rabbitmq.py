from app.messaging.rabbitmq import (
    PAYMENT_SUCCEEDED_EVENT,
    RabbitMqSettings,
    declare_topology,
)


class RecordingChannel:
    def __init__(self):
        self.calls = []

    def exchange_declare(self, **kwargs):
        self.calls.append(("exchange_declare", kwargs))

    def queue_declare(self, **kwargs):
        self.calls.append(("queue_declare", kwargs))

    def queue_bind(self, **kwargs):
        self.calls.append(("queue_bind", kwargs))


def test_default_rabbitmq_settings_use_payment_succeeded_topology():
    settings = RabbitMqSettings()

    assert PAYMENT_SUCCEEDED_EVENT == "PaymentSucceededEvent"
    assert settings.exchange == "payment.events"
    assert settings.queue == "order-service.payment-succeeded"
    assert settings.routing_key == "payment.succeeded"


def test_declares_durable_exchange_queue_and_binding():
    channel = RecordingChannel()

    declare_topology(channel)

    assert channel.calls == [
        (
            "exchange_declare",
            {
                "exchange": "payment.events",
                "exchange_type": "topic",
                "durable": True,
            },
        ),
        (
            "queue_declare",
            {"queue": "order-service.payment-succeeded", "durable": True},
        ),
        (
            "queue_bind",
            {
                "queue": "order-service.payment-succeeded",
                "exchange": "payment.events",
                "routing_key": "payment.succeeded",
            },
        ),
    ]
