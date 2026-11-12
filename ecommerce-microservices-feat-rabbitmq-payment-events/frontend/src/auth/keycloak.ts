import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8180",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "EcommerceRealm",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "ecommerce-frontend",
});

let initialization: Promise<boolean> | undefined;

export function initializeKeycloak(): Promise<boolean> {
  initialization ??= keycloak.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    responseMode: "query",
    checkLoginIframe: false,
  });
  return initialization;
}

export async function freshAccessToken(): Promise<string | undefined> {
  if (!keycloak.authenticated) return undefined;
  await keycloak.updateToken(30);
  return keycloak.token;
}
