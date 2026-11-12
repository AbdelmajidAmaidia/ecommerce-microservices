import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import security


@pytest.fixture
def keycloak_token(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(public_key))
    jwk["kid"] = "demo-key"

    monkeypatch.setenv("KEYCLOAK_ENABLED", "true")
    monkeypatch.setenv("KEYCLOAK_REALM_URL", "http://localhost:8180/realms/EcommerceRealm")
    monkeypatch.setenv("KEYCLOAK_CLIENT_ID", "ecommerce-api")
    monkeypatch.setattr(security, "_fetch_jwks", lambda: {"keys": [jwk]})
    security._fetch_jwks.cache_clear() if hasattr(security._fetch_jwks, "cache_clear") else None

    def make_token(roles, audience="ecommerce-api", expired=False):
        now = int(time.time())
        payload = {
            "sub": "user-123",
            "iss": "http://localhost:8180/realms/EcommerceRealm",
            "aud": audience,
            "exp": now + (-60 if expired else 300),
            "realm_access": {"roles": roles},
            "preferred_username": "clientshop",
        }
        return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "demo-key"})

    return make_token


def test_requires_bearer_token_for_orders(client, keycloak_token):
    response = client.get("/api/orders")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token"


def test_accepts_valid_keycloak_token(client, keycloak_token):
    token = keycloak_token(["user"])
    response = client.get("/api/orders", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_rejects_bad_audience_or_expired_token(client, keycloak_token):
    invalid_audience = keycloak_token(["user"], audience="wrong-client")
    response = client.get("/api/orders", headers={"Authorization": f"Bearer {invalid_audience}"})
    assert response.status_code == 401

    expired = keycloak_token(["user"], expired=True)
    response = client.get("/api/orders", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
