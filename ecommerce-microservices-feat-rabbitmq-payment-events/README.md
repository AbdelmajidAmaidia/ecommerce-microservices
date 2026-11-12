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

Les documents du projet décrivent un worker Order séparé, mais le module `app.messaging` et son implémentation ne sont pas présents dans les sources actuelles. Aucun consommateur n'est donc lancé par ce dépôt ; le passage de la commande de `pending` à `confirmed` après événement n'est pas opérationnel dans cet état.

```text
Client -> Payment Service --REST GET--> Order Service -> MySQL
                   |
                   +-- JSON PaymentSucceededEvent
                       -> payment.exchange
                          -> payment.succeeded.queue
                             -> consommateur Order (absent des sources)
```

La Gateway et Payment Service ont des décodeurs JWT Keycloak. Order Service n'a pas de validation JWT dans son code actuel, malgré les anciennes instructions de son README ; son port n'est donc pas publié par Compose. Le realm doit exposer l'audience `ecommerce-api` et les rôles `admin` et `user`.

La configuration attendue par le consommateur décrit :

- direct exchange : `payment.exchange`
- queue : `payment.succeeded.queue`
- routing key : `payment.succeeded`

Le producteur ne déclare ni l'exchange ni la queue. En l'absence du worker, une nouvelle instance RabbitMQ n'a pas cette topologie : il faut rétablir l'implémentation du consommateur avant de valider le flux de paiement de bout en bout.

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

Les paramètres prévus pour le producteur et le consommateur sont :

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

### Order Service API

```powershell
cd order-service\order-service
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.init_db
python -m uvicorn app.main:app --host 0.0.0.0 --port 8085
```

Le worker décrit dans les versions précédentes de cette procédure n'est pas présent dans les sources actuelles. Les identifiants RabbitMQ ne sont donc pas nécessaires pour lancer l'API Order.

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

Payment Service publie un événement après un paiement `SUCCEEDED`, mais le worker Order absent ne le consomme pas. Le changement de statut vers `confirmed` n'est donc pas un résultat attendu tant que ce worker n'a pas été rétabli.

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

La publication est effectuée après `MongoRepository.save`, mais sans transaction distribuée ni outbox. Si MongoDB confirme puis que RabbitMQ devient indisponible, le paiement reste enregistré et l'événement peut manquer. Le producteur journalise et remonte l'erreur ; une nouvelle requête avec la même clé d'idempotence tente de republier l'événement. Un consommateur devra rendre les doublons inoffensifs lorsque la commande est déjà `confirmed`. Pour un système de production, une outbox MongoDB et un relay avec confirmations seraient nécessaires.

## Préparer Docker Compose

Créez le fichier local de configuration puis remplacez toutes les valeurs `CHANGE_ME` avant le démarrage :

```powershell
Copy-Item .env.docker.example .env.docker
```

Le realm `EcommerceRealm` n'est pas exporté dans le dépôt. Après avoir arrêté l'instance Keycloak locale, exportez son realm et ses utilisateurs (adaptez le chemin d'installation et conservez la même configuration de base de données que l'instance locale) :

```powershell
$KeycloakHome = "C:\chemin\vers\keycloak"
$ExportDir = Join-Path (Get-Location) "keycloak\realm-import"
New-Item -ItemType Directory -Force $ExportDir | Out-Null
& (Join-Path $KeycloakHome "bin\kc.bat") export `
    --dir $ExportDir --realm EcommerceRealm --users different_files
```

L'export peut contenir des données d'utilisateurs et des empreintes d'identifiants ; les fichiers du répertoire d'import sont ignorés par Git et montés en lecture seule, pas copiés dans les images. Les identifiants `KEYCLOAK_ADMIN_*` du fichier local sont des valeurs de bootstrap à choisir ; aucun compte de realm n'est ajouté par Compose. Vérifiez que l'image Keycloak choisie est compatible avec la version de l'instance ayant produit l'export.

Après création et édition de `.env.docker`, validez la configuration sans démarrer les services :

```powershell
docker compose --env-file .env.docker config --quiet
```

Le service `order-worker` n'est volontairement pas déclaré : son implémentation est absente des sources actuelles.
