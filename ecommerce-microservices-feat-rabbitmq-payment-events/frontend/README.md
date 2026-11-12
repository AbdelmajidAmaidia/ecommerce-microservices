# Frontend E-commerce Microservices

Application React + TypeScript de gestion des commandes et paiements de démonstration. Toutes les requêtes métier passent par l'API Gateway ; le navigateur ne se connecte ni aux bases de données ni à RabbitMQ.

## Prérequis et lancement Windows

- Node.js 20.19+ (ou 22.12+) et npm
- Keycloak démarré sur le port `8180`
- API Gateway démarrée sur le port `8080`
- Services Order et Payment opérationnels pour les pages correspondantes

Depuis la racine du dépôt :

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Le site écoute sur `http://localhost:5173`. Vite relaie `/api` vers `http://localhost:8080` afin d'éviter une dépendance à un réglage CORS du Gateway en développement. Le client API utilise `VITE_API_BASE_URL=/api`; les chemins envoyés à la Gateway restent `/api/orders` et `/api/payments`. Pour une autre adresse locale de Gateway, modifier `VITE_API_PROXY_TARGET`.

Vérifications :

```powershell
npm run typecheck
npm test
npm run build
```

## Configuration Keycloak requise

Créer un client distinct `ecommerce-frontend` dans le realm `EcommerceRealm` :

1. Type de client : OpenID Connect.
2. Client authentication : **OFF** (client public).
3. Standard flow : **ON** ; Direct access grants et service accounts : **OFF**.
4. PKCE : méthode **S256**.
5. Valid redirect URI : `http://localhost:5173/*`.
6. Web origin : `http://localhost:5173`.
7. Ajouter au jeton d'accès l'audience `ecommerce-api` (mapper Audience) utilisée par les resource servers.
8. Affecter les rôles realm `admin` ou `user` aux utilisateurs. Les rôles doivent apparaître sous `realm_access.roles`.

Le frontend ne contient aucun secret client. Les variables de configuration sont dans `.env.example` :

| Variable | Valeur locale | Rôle |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Préfixe local des appels à l'API Gateway |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Cible du proxy Vite |
| `VITE_KEYCLOAK_URL` | `http://localhost:8180` | Adresse Keycloak |
| `VITE_KEYCLOAK_REALM` | `EcommerceRealm` | Realm OAuth2/OIDC |
| `VITE_KEYCLOAK_CLIENT_ID` | `ecommerce-frontend` | Client public du navigateur |
| `VITE_API_AUDIENCE` | `ecommerce-api` | Audience attendue par les resource servers |

La connexion utilise Authorization Code Flow avec PKCE S256. `keycloak-js` garde l'access token en mémoire, demande son renouvellement avant expiration et ne l'écrit pas dans `localStorage`. La vérification de session utilise une redirection de premier niveau ; elle n'utilise pas d'iframe cross-origin susceptible d'être bloquée par la CSP de Keycloak.
Les routes authentifiées vérifient également que le claim `aud` du jeton contient `ecommerce-api`; en l'absence de cette audience, l'application bloque les appels protégés et affiche une consigne de configuration Keycloak.
L'API Gateway doit être lancée avec `KEYCLOAK_ENABLED=true` pour activer son Resource Server :

```powershell
cd api-gateway\api-gateway
$env:KEYCLOAK_ENABLED = "true"
mvn spring-boot:run
```

## Pages

- **Accueil / Connexion** : présentation et redirection vers Keycloak ; aucun formulaire de mot de passe local.
- **Vue d'ensemble** : profil et avertissement de portée pour l'utilisateur ; l'administrateur voit des compteurs calculés sur les réponses API (les limites de page sont indiquées).
- **Commandes** : l'administrateur peut lire les 100 premières commandes, filtrer, consulter le détail, créer une commande à partir des champs FastAPI réels et appliquer uniquement les transitions métier existantes.
- **Paiements** : l'administrateur peut parcourir les pages retournées, filtrer par commande/statut, créer un paiement simulé, consulter son détail et finaliser un paiement `PENDING`.
- **Profil** : claims de profil et rôles transmis par Keycloak.
- Pages 403 et 404.

Les appels utilisent les vrais contrats backend : création d'une commande avec `customer_id`, `currency` et `items[{product_id, quantity, unit_price}]`; création d'un paiement avec `orderId`, `method` (`SIMULATED_CARD` ou `CASH_ON_DELIVERY`) et `idempotencyKey`. Aucun numéro de carte n'est demandé. Après un paiement réussi, le frontend relit la commande au plus cinq fois pour observer l'événement RabbitMQ traité par le worker.

## Limites d'autorisation du backend

Les routes actuelles de commandes permettent une liste générale et la recherche par `customer_id`, mais ne prouvent pas que ce champ appartient au sujet Keycloak connecté. L'API Payment renvoie aussi une liste générale et ne lie pas un paiement à un sujet. Un identifiant saisi par le navigateur n'est pas une preuve de propriété. Par précaution, listes globales, création administrative et changements de statut sont affichés uniquement au rôle `admin`; les utilisateurs ne voient pas les dossiers globaux.

Pour donner à chaque utilisateur une page personnelle et lui permettre de créer ou payer ses propres commandes, le backend doit associer un identifiant fiable au `sub` Keycloak et appliquer les contrôles de propriété côté service. Le frontend ne peut pas garantir cette règle. L'interface masque les fonctions selon les rôles, mais cette restriction UI ne remplace jamais l'autorisation backend.

Dans le code Order Service examiné, les routes FastAPI n'ont pas de dépendance de validation JWT. La sécurité de la Gateway ne protège donc pas un accès direct au port `8085`. Restreignez l'accès réseau à ce port ou ajoutez la validation côté service avant toute exposition hors du poste local. Le frontend lui-même n'appelle jamais directement ce port.

Le catalogue produits, les données bancaires réelles, les WebSockets et un accès direct à RabbitMQ ne sont pas implémentés, car les services/contrats correspondants n'existent pas dans le backend.
