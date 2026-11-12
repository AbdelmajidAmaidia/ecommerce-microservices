import axios from "axios";
import { freshAccessToken } from "../auth/keycloak";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 12_000,
});

api.interceptors.request.use(async (config) => {
  const token = await freshAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { api };
