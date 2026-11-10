# Payment Service

Microservice Spring Boot de démonstration pour gérer des paiements **simulés**. Aucune transaction bancaire n'est effectuée et aucune donnée de carte n'est stockée.

## Prérequis

- JDK 21 (version ciblée par le projet)
- Maven 3.9+
- MongoDB Community Server en local (MongoDB 7+ recommandé)
- Docker Desktop pour exécuter les tests d'intégration Testcontainers

## 1. Installer et démarrer MongoDB sous Windows

Installez [MongoDB Community Server pour Windows](https://www.mongodb.com/try/download/community). L'installateur Windows peut configurer MongoDB comme service Windows ; MongoDB Compass peut être installé en même temps ou séparément.

Dans PowerShell, vérifiez la présence du serveur et son état :

```powershell
Get-Service MongoDB
```

Si le service existe mais est arrêté, ouvrez PowerShell en administrateur puis lancez :

```powershell
Start-Service MongoDB
```

Vérifiez le port par défaut et la réponse du serveur :

```powershell
Test-NetConnection localhost -Port 27017
mongosh "mongodb://localhost:27017/payment_db" --eval "db.runCommand({ ping: 1 })"
```

Si vous avez installé MongoDB sans service Windows, démarrez-le manuellement dans un premier terminal PowerShell :

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\MongoDB\data"
mongod --dbpath "$env:LOCALAPPDATA\MongoDB\data" --bind_ip 127.0.0.1 --port 27017
```

Laissez cette fenêtre ouverte tant que le service est utilisé. La création de la base et de la collection est automatique au premier paiement.

## 2. Connexion avec MongoDB Compass

1. Ouvrez MongoDB Compass.
2. Dans le champ URI, saisissez `mongodb://localhost:27017`.
3. Cliquez sur **Connect**.
4. Après avoir créé un paiement, ouvrez la base `payment_db`, puis la collection `payments`.

Compass se connecte au serveur MongoDB local pour explorer les données. L'application Spring Boot se connecte directement au serveur avec son URI ; Compass n'est pas un intermédiaire.

## 3. Configuration de l'application

La configuration par défaut est `mongodb://localhost:27017/payment_db`. Le projet demande à Spring de créer l'index MongoDB au démarrage ; l'intégration vérifie son existence et l'unicité effective lorsque les tests s'exécutent sur MongoDB. Tant que cette vérification n'a pas été exécutée avec un serveur disponible, ne considérez pas l'index comme validé. Si la base est indisponible, l'application ne bascule pas vers une persistance de substitution.

Copiez `.env.example` si vous souhaitez garder un exemple local, puis définissez la variable dans la session PowerShell. Spring Boot ne charge pas automatiquement un fichier `.env`.

| Variable | Valeur locale par défaut | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/payment_db` | URI MongoDB configurable |
| `ORDER_CLIENT_MODE` | `local` | `local` ou `remote` |
| `ORDER_SERVICE_BASE_URL` | `http://localhost:8085` | URL de `order-service` en mode distant ; l'ancienne variable `ORDER_SERVICE_URL` reste acceptée |
| `ORDER_SERVICE_CONNECT_TIMEOUT` | `2s` | Délai maximal de connexion au service de commande |
| `ORDER_SERVICE_READ_TIMEOUT` | `3s` | Délai maximal d'attente de sa réponse |
| `LOCAL_ORDER_IDS` | `1001,1002` | Commandes fictives connues du mode local |
| `LOCAL_ORDER_AMOUNT` | `49.99` | Montant de démonstration des commandes locales |
| `LOCAL_ORDER_CURRENCY` | `TND` | Devise des commandes locales |
| `PAYMENT_CURRENCY` | `TND` | Devise autorisée par ce service |
| `SIMULATED_DECLINED_ORDER_IDS` | `1002` | Commandes pour lesquelles la carte simulée est refusée |
| `RABBITMQ_HOST` | `localhost` | Hôte du broker RabbitMQ |
| `RABBITMQ_PORT` | `5672` | Port AMQP |
| `RABBITMQ_USERNAME` / `RABBITMQ_PASSWORD` | `guest` / `guest` | Identifiants locaux de démonstration |
| `RABBITMQ_VIRTUAL_HOST` | `/` | Virtual host RabbitMQ |
| `RABBITMQ_EXCHANGE` | `payment.events` | Exchange topic durable |
| `RABBITMQ_QUEUE` | `order-service.payment-succeeded` | Queue durable préparée pour Order Service |
| `RABBITMQ_ROUTING_KEY` | `payment.succeeded` | Clé de routage de `PaymentSucceededEvent` |

N'enregistrez aucun vrai mot de passe dans le code source ou dans `.env.example`. En environnement protégé, fournissez une URI avec identifiants via une variable d'environnement ou un gestionnaire de secrets.

Le mode local ne vérifie aucune commande réelle : il accepte uniquement les identifiants fictifs configurés. L'identifiant `1001` simule un paiement par carte réussi ; `1002` simule un refus. Le paiement à la livraison reste `PENDING` jusqu'à sa finalisation. Le montant vient de `OrderClient`, jamais du frontend.

## 4. Lancer `payment-service`

Depuis PowerShell, dans le dossier du projet, après avoir démarré MongoDB :

```powershell
$env:MONGODB_URI = "mongodb://localhost:27017/payment_db"
$env:ORDER_CLIENT_MODE = "local"
mvn spring-boot:run
```

Le service écoute sur `http://localhost:8084`. Le mode local est le mode par défaut. Pour joindre le service FastAPI sur le port 8085, utilisez un terminal PowerShell distinct pour chaque service. Dans le terminal du Payment Service :

```powershell
$env:MONGODB_URI = "mongodb://localhost:27017/payment_db"
$env:ORDER_CLIENT_MODE = "remote"
$env:ORDER_SERVICE_BASE_URL = "http://localhost:8085"
$env:ORDER_SERVICE_CONNECT_TIMEOUT = "2s"
$env:ORDER_SERVICE_READ_TIMEOUT = "3s"
mvn spring-boot:run
```

Le client distant effectue réellement `GET http://localhost:8085/api/orders/{orderId}`. Il lit le JSON de l'Order Service (`id`, `total_amount`, `currency`, `status` et éventuellement `items`) ; seul le montant retourné par ce service est utilisé. Une commande ne peut être payée que si son statut est `pending` : `confirmed` et les statuts ultérieurs indiquent qu'elle a déjà dépassé l'étape d'attente du paiement. Une commande inconnue renvoie `404`, un statut non payable `409`, une réponse invalide `502` et une indisponibilité/un délai dépassé `503`. Aucun échec distant n'est converti en paiement réussi.

Dans le terminal du projet Order Service, lancez son point d'entrée FastAPI configuré sur le port 8085 avant de démarrer le paiement. Le dépôt Order Service et son module ASGI ne font pas partie de ce workspace ; son nom de module n'étant pas vérifiable ici, la commande exacte `uvicorn <module>:app` dépend de son arborescence.

Pour ne pas conserver l'URI dans la session PowerShell, Spring utilise la valeur locale par défaut si `MONGODB_URI` n'est pas définie.

### Préparer RabbitMQ

La dépendance `spring-boot-starter-amqp` configure `RabbitTemplate`, un
convertisseur JSON, ainsi qu'un exchange `payment.events`, une queue durable
`order-service.payment-succeeded` et leur binding topic sur
`payment.succeeded`. `PaymentSucceededEvent` et `PaymentEventPublisher`
définissent le contrat et le point de publication pour le cours, mais la
publication n'est volontairement pas appelée par le traitement actuel des
paiements. Les appels REST à `order-service` et les transitions de statut sont
inchangés.

Démarrez un broker local avant de tester cette connexion :

```powershell
docker run --name ecommerce-rabbitmq --rm `
  -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

Vérifiez ensuite réellement `localhost:5672` (ou l'interface
`http://localhost:15672`) avant d'affirmer que RabbitMQ est opérationnel. La
configuration et les tests unitaires peuvent être exécutés sans broker ; cette
validation n'a pas été remplacée par un simple test de contexte Spring.

## 5. Tester l'API avec Swagger

- Swagger UI : <http://localhost:8084/swagger-ui/index.html>
- Document OpenAPI : <http://localhost:8084/v3/api-docs>

Endpoints principaux :

| Méthode | URL | Description |
|---|---|---|
| `POST` | `/api/payments` | Créer une tentative de paiement (201) |
| `GET` | `/api/payments?page=0&size=20` | Lister avec pagination |
| `GET` | `/api/payments?orderId=1001&status=SUCCEEDED` | Filtrer par commande et/ou statut |
| `GET` | `/api/payments/{id}` | Consulter un paiement par identifiant MongoDB |
| `PATCH` | `/api/payments/{id}/status` | Finaliser un paiement en attente |

Exemple de corps pour `POST /api/payments` :

```json
{
  "orderId": 1001,
  "method": "SIMULATED_CARD",
  "idempotencyKey": "demo-order-1001"
}
```

Le montant n'est pas fourni par l'appelant : il est résolu depuis `OrderClient`. Les moyens de paiement simulés sont `SIMULATED_CARD` et `CASH_ON_DELIVERY`. La réponse contient un identifiant de paiement en chaîne compatible ObjectId (24 caractères hexadécimaux) ; `orderId` reste l'identifiant métier de la commande.

Pour finaliser un paiement à la livraison, transmettez `{"status":"SUCCEEDED"}` ou `{"status":"FAILED"}` à `PATCH /api/payments/{id}/status`. Seule une transition `PENDING` vers un statut terminal est permise. Cette opération de démonstration doit être protégée avant toute exposition en production.

Les erreurs sont des réponses JSON contenant `timestamp`, `status`, `error`, `message`, `path` et éventuellement `details`. Une clé d'idempotence utilisée pour une autre opération renvoie `409 Conflict`.

## 6. Vérifier les documents dans Compass

Après une création réussie, actualisez l'explorateur Compass, puis ouvrez `payment_db` > `payments`. Chaque document contient notamment `_id` (identifiant du paiement), `orderId`, `amount`, `currency`, `method`, `status`, `createdAt`, `updatedAt` et `idempotencyKey`. La contrainte d'unicité de clé d'idempotence est appliquée par un index MongoDB unique partiel.

## 7. Exécuter les tests

Les tests unitaires utilisent Mockito. Les tests d'intégration utilisent MongoDB réel : ils démarrent le conteneur `mongo:7.0.14` via Testcontainers lorsque Docker est accessible, puis vérifient l'index unique et son rejet effectif des doublons.

```powershell
mvn test
```

Si Docker n'est pas disponible, démarrez une instance MongoDB dédiée aux tests sur `localhost:27017` ; la suite utilise alors `mongodb://localhost:27017/payment_test_db`. Vous pouvez préciser une autre URI de test dans PowerShell avant Maven :

```powershell
$env:PAYMENT_TEST_MONGODB_URI = "mongodb://localhost:27017/payment_test_db"
mvn test
```

N'utilisez jamais la base de développement `payment_db` comme base de test.

## Notes de migration

La persistance utilise Spring Data MongoDB et `MongoRepository`. L'index d'idempotence est partiel pour ignorer les valeurs absentes ou nulles, mais l'API exige une clé non vide. Le simulateur reste pédagogique : il ne réalise ni autorisation bancaire, ni capture, ni remboursement, ni notification de `order-service`.
