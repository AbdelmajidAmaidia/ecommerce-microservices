# E-commerce Microservices

Projet académique de microservices e-commerce :

| Service | Technologie | Port |
| --- | --- | --- |
| Eureka Server | Spring Boot / Eureka | 8761 |
| API Gateway | Spring Cloud Gateway | 8080 |
| Order Service | FastAPI / Python / MySQL | 8085 |
| Payment Service | Spring Boot / MongoDB | 8084 |
| RabbitMQ AMQP / Management | Broker | 5672 / 15672 |

## Communication REST + RabbitMQ

Le client appelle `Payment Service`. Celui-ci conserve la consultation et la validation REST de la commande auprès de `Order Service`, simule le paiement, puis enregistre le paiement dans MongoDB. Après l’enregistrement d’un paiement `SUCCEEDED`, il publie le JSON `PaymentSucceededEvent`.

`Order Service` exécute un worker séparé qui consomme cet événement, vérifie la commande dans MySQL et applique uniquement la transition déjà autorisée `pending -> confirmed`. Un paiement `FAILED` ou `PENDING` ne publie aucun événement.

```text
Client -> Payment Service --REST GET--> Order Service -> MySQL
                   |
                   +-- JSON PaymentSucceededEvent
                       -> payment.exchange
                          -> payment.succeeded.queue
                             -> Order worker -> MySQL
```

Le consommateur déclare de façon idempotente et durable :

- direct exchange : `payment.exchange`
- queue : `payment.succeeded.queue`
- routing key : `payment.succeeded`

Le producteur publie vers l’exchange et ne déclare pas la queue. C’est différent de l’atelier utilisant directement l’exchange par défaut (`""`) avec le nom de queue comme routing key : ici l’exchange direct permet de faire évoluer les bindings sans coupler le producteur au nom de la queue.

## Configurer RabbitMQ sous Windows

Ne supposez pas que `guest/guest` est utilisable : RabbitMQ limite généralement cet utilisateur aux connexions locales et il peut avoir été supprimé ou désactivé. Dans PowerShell, utilisez les exécutables installés par Chocolatey (ajoutez le dossier RabbitMQ `sbin` au `PATH` si nécessaire) :

```powershell
rabbitmq-diagnostics.bat ping
rabbitmq-plugins.bat list
rabbitmqctl.bat list_users
rabbitmqctl.bat list_vhosts
rabbitmqctl.bat list_permissions -p /
```

Créez un utilisateur local dédié et ses permissions. Le mot de passe ci-dessous reste seulement dans la session PowerShell ; remplacez le placeholder par une valeur locale non commitée :

```powershell
$RabbitPassword = Read-Host "Mot de passe RabbitMQ local"
rabbitmqctl.bat add_user ecommerce_app $RabbitPassword
rabbitmqctl.bat set_user_tags ecommerce_app management
rabbitmqctl.bat set_permissions -p / ecommerce_app ".*" ".*" ".*"
rabbitmqctl.bat list_user_permissions ecommerce_app
```

Vous pouvez vérifier le broker sur `http://localhost:15672` avec cet utilisateur. Le port AMQP est `5672`. Ne mettez jamais ce mot de passe dans `.env.example` ou dans Git.

## Variables RabbitMQ

Les deux services lisent les mêmes paramètres :

```text
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=ecommerce_app
RABBITMQ_PASSWORD=<mot-de-passe-local>
RABBITMQ_VIRTUAL_HOST=/
RABBITMQ_PAYMENT_EXCHANGE=payment.exchange
RABBITMQ_PAYMENT_QUEUE=payment.succeeded.queue   # Order Service
RABBITMQ_PAYMENT_ROUTING_KEY=payment.succeeded
```

Les fichiers `payment-service/.env.example` et `order-service/.env.example` contiennent uniquement des placeholders. Spring Boot ne charge pas automatiquement `.env` : définissez les variables dans PowerShell ou utilisez votre mécanisme local de configuration.

## Démarrage PowerShell

### Eureka

```powershell
cd eureka-server\eureka-server
mvn spring-boot:run
```

### Order Service et worker

```powershell
cd order-service\order-service
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
$env:RABBITMQ_USERNAME = "ecommerce_app"
$env:RABBITMQ_PASSWORD = "<mot-de-passe-local>"
python -m app.init_db
python -m uvicorn app.main:app --host 0.0.0.0 --port 8085
```

Dans un second terminal, avec le même environnement :

```powershell
cd order-service\order-service
.\.venv\Scripts\Activate.ps1
$env:RABBITMQ_USERNAME = "ecommerce_app"
$env:RABBITMQ_PASSWORD = "<mot-de-passe-local>"
python -m app.messaging.worker
```

Le worker est volontairement distinct du serveur FastAPI. À son démarrage, vérifiez dans Management que `payment.succeeded.queue` existe et contient `0` message en attente.

### Payment Service

```powershell
cd payment-service\payment-service
$env:MONGODB_URI = "mongodb://localhost:27017/payment_db"
$env:ORDER_CLIENT_MODE = "remote"
$env:ORDER_SERVICE_BASE_URL = "http://localhost:8085"
$env:RABBITMQ_USERNAME = "ecommerce_app"
$env:RABBITMQ_PASSWORD = "<mot-de-passe-local>"
mvn spring-boot:run
```

Eureka, MySQL et MongoDB doivent être démarrés séparément. Les ports REST restent inchangés : Gateway `8080`, Order `8085`, Payment `8084`.

## Test de bout en bout

Créer une commande puis demander le paiement :

```powershell
$orderBody = @{
    customer_id = 42
    currency = "TND"
    items = @(@{ product_id = "book-1"; quantity = 1; unit_price = "10.00" })
} | ConvertTo-Json -Depth 5
$order = Invoke-RestMethod -Method Post -Uri http://localhost:8085/api/orders `
    -ContentType "application/json" -Body $orderBody

$paymentBody = @{
    orderId = $order.id
    method = "SIMULATED_CARD"
    idempotencyKey = "demo-$($order.id)"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8084/api/payments `
    -ContentType "application/json" -Body $paymentBody
```

Attendus : la réponse Payment contient `SUCCEEDED`, le log Java indique la publication, le log du worker indique la consommation, puis `GET http://localhost:8085/api/orders/$($order.id)` retourne `confirmed`. Dans Management, utilisez **Queues and Streams**, puis `payment.succeeded.queue` pour vérifier les messages prêts et les taux de publication/consommation. Un message consommé est ACKé et disparaît de la file.

## Tests

Order Service :

```powershell
cd order-service\order-service
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

Payment Service :

```powershell
cd payment-service\payment-service
mvn test
```

Les tests unitaires ne prouvent pas une connexion réelle au broker. Le test de bout en bout ci-dessus nécessite RabbitMQ, MySQL, MongoDB, Eureka et les deux processus accessibles ; si l’un manque, le résultat doit être considéré comme non exécuté, pas comme une preuve d’intégration.

## Limite de cohérence

La publication est effectuée après `MongoRepository.save`, mais sans transaction distribuée ni outbox. Si MongoDB confirme puis que RabbitMQ devient indisponible, le paiement reste enregistré et l’événement peut manquer. Le producteur journalise et remonte l’erreur ; une nouvelle requête avec la même clé d’idempotence tente de republier l’événement, et le consommateur rend les doublons inoffensifs lorsque la commande est déjà `confirmed`. Pour un système de production, une outbox MongoDB et un relay avec confirmations seraient nécessaires.
