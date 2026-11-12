import logging

from app.messaging.rabbitmq import PaymentConsumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


if __name__ == "__main__":
    PaymentConsumer().run()
