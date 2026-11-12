import axios from "axios";

const statusMessages: Record<number, string> = {
  400: "La requête est invalide. Vérifiez les champs saisis.",
  401: "Votre session a expiré ou votre jeton n'est plus valide. Reconnectez-vous.",
  403: "Votre compte ne dispose pas des permissions nécessaires.",
  404: "La ressource demandée est introuvable.",
  500: "Une erreur est survenue sur le serveur.",
  503: "Le service demandé est temporairement indisponible.",
};

export function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
  }

  const status = error.response?.status;
  if (status && statusMessages[status]) return statusMessages[status];

  const data = error.response?.data;
  const detail = data?.detail;
  const message = data?.error?.message ?? data?.message;
  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;
  if (Array.isArray(detail)) {
    const validationMessages = detail
      .map((item: unknown) => (typeof item === "object" && item !== null && "msg" in item ? item.msg : null))
      .filter((item): item is string => typeof item === "string");
    if (validationMessages.length) return validationMessages.join(" ");
  }
  if (error.code === "ECONNABORTED") return "La requête a expiré. Réessayez.";
  if (!error.response) return "Impossible de joindre l'API Gateway (http://localhost:8080).";
  return "La requête n'a pas abouti.";
}
