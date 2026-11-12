# Order Service

Microservice REST de démonstration pour créer et consulter des commandes e-commerce. Il utilise Python 3, FastAPI, SQLAlchemy 2, MySQL/PyMySQL, Pydantic et Uvicorn. FastAPI expose automatiquement Swagger UI sur `/docs` et OpenAPI sur `/openapi.json`.

> **Prix des produits :** pour cette démonstration, le client transmet les prix unitaires. En production, le service doit récupérer et vérifier les prix auprès du service Produits avant d'enregistrer une commande.

## Configuration Windows PowerShell

Depuis le dossier `order-service` :

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Modifiez ensuite `.env` avec les paramètres de votre MySQL. Les valeurs de `.env.example` sont des exemples à remplacer, pas des identifiants valides. Alternative : définir `DATABASE_URL` avec une URL `mysql+pymysql://...`. Ne commitez jamais `.env`.

La base et l'utilisateur MySQL doivent exister et avoir les permissions nécessaires. Par exemple, après connexion à MySQL avec un compte administrateur, créez la base et accordez les droits à votre utilisateur applicatif en utilisant vos propres identifiants. Le service ne crée pas automatiquement la base elle-même.

La configuration Eureka est également définie dans `.env` : `EUREKA_ENABLED`,
`EUREKA_SERVER`, `EUREKA_APP_NAME`, `EUREKA_INSTANCE_HOST` et
`EUREKA_INSTANCE_PORT`. Les valeurs par défaut ciblent le serveur local
`http://localhost:8761/eureka/`, enregistrent `order-service` sur le port
`8085` et annoncent l'adresse locale Windows `127.0.0.1`. Si Eureka ou les
clients sont sur d'autres machines, remplacez `EUREKA_INSTANCE_HOST` par une
adresse IP ou un nom d'hôte joignable depuis ces machines. Une panne ou une
indisponibilité temporaire d'Eureka est journalisée sans empêcher FastAPI de
démarrer. La valeur `EUREKA_ENABLED=false` désactive l'intégration.

Initialisez les tables `orders` et `order_items` :

```powershell
python -m app.init_db
```

Lancez le service sur le port `8085` :

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8085 --reload
```

Vérification : `Invoke-RestMethod http://localhost:8085/health`. Documentation interactive : `http://localhost:8085/docs`.
Après démarrage, vérifiez dans le tableau de bord Eureka
(`http://localhost:8761`) que `ORDER-SERVICE` apparaît avant de considérer
l'enregistrement confirmé. Le démarrage de l'application seul ne garantit pas
que le serveur Eureka ait accepté l'instance.

## Endpoints

| Méthode | Chemin | Description |
| --- | --- | --- |
| `POST` | `/api/orders` | Créer une commande (`201`) |
| `GET` | `/api/orders` | Lister avec `offset`, `limit` et filtre optionnel `status` |
| `GET` | `/api/orders/{order_id}` | Consulter une commande |
| `GET` | `/api/orders/customer/{customer_id}` | Lister les commandes d'un client, avec pagination |
| `PATCH` | `/api/orders/{order_id}/status` | Changer le statut si la transition est permise |
| `POST` | `/api/orders/{order_id}/cancel` | Annuler une commande annulable |
| `GET` | `/health` | Vérifier que le processus répond |

Les statuts sont `pending`, `confirmed`, `processing`, `shipped`, `delivered` et `cancelled`. Transitions permises :

- `pending` → `confirmed` ou `cancelled`
- `confirmed` → `processing` ou `cancelled`
- `processing` → `shipped`
- `shipped` → `delivered`
- `delivered` et `cancelled` sont terminaux

Une transition interdite ou une annulation impossible renvoie `400`; un identifiant absent renvoie `404`; les données invalides renvoient `422`. Toutes les erreurs suivent la forme `{"error":{"code":"...","message":"...","details":...}}`.

## Exemples

Créer une commande (PowerShell) :

```powershell
$body = @{
    customer_id = 42
    currency = "TND"
    items = @(
        @{ product_id = "book-1"; quantity = 2; unit_price = "12.50" },
        @{ product_id = "pen-2"; quantity = 3; unit_price = "1.20" }
    )
} | ConvertTo-Json -Depth 5

$order = Invoke-RestMethod -Method Post `
    -Uri http://localhost:8085/api/orders `
    -ContentType "application/json" `
    -Body $body
```

Exemple de réponse (les champs d'horodatage et identifiants sont générés) :

```json
{
  "id": 1,
  "customer_id": 42,
  "items": [
    {"id": 1, "product_id": "book-1", "quantity": 2, "unit_price": "12.50"},
    {"id": 2, "product_id": "pen-2", "quantity": 3, "unit_price": "1.20"}
  ],
  "total_amount": "28.60",
  "currency": "TND",
  "status": "pending",
  "created_at": "2026-10-26T19:16:00",
  "updated_at": "2026-10-26T19:16:00"
}
```

Changer le statut et filtrer :

```powershell
Invoke-RestMethod -Method Patch `
    -Uri "http://localhost:8085/api/orders/1/status" `
    -ContentType "application/json" `
    -Body '{"status":"confirmed"}'

Invoke-RestMethod "http://localhost:8085/api/orders?status=confirmed&offset=0&limit=20"
```

## Contrat de lecture pour Payment Service

`GET /api/orders/{order_id}` renvoie notamment les champs nécessaires à une lecture de commande côté paiement :

```json
{
  "id": 1,
  "total_amount": "28.60",
  "currency": "TND",
  "status": "pending"
}
```

Le montant est sérialisé en chaîne décimale JSON afin de préserver sa précision. La réponse complète contient aussi `customer_id`, `items`, `created_at` et `updated_at`. Ce contrat est documenté comme proposition côté Order Service ; l'intégration avec le Payment Service **n'est pas confirmée** : son `OrderClient` n'a pas été disponible pour vérifier le chemin, les noms/types des champs ou le format attendu. Vérifiez ces éléments auprès de son code avant de déclarer l'intégration terminée. Le Payment Service est indiqué comme utilisant le port `8084`; Order Service écoute sur `8085`.

## Tests

Les tests n'utilisent pas la base MySQL de développement : chaque exécution crée une base SQLite en mémoire isolée. Les tests Eureka simulent le client et ne contactent aucun serveur Eureka. `tests/test_mysql.py` reste un contrôle manuel de connexion à MySQL, à exécuter séparément lorsqu'une vérification réelle est voulue.

```powershell
python -m pytest -q
```

Contrôle MySQL manuel, si nécessaire :

```powershell
python tests/test_mysql.py
```

## Initialisation et erreurs

Les tables sont créées explicitement avec `python -m app.init_db`, après configuration et création de la base MySQL. Les erreurs applicatives et de validation utilisent une réponse JSON centralisée. Les détails techniques des erreurs internes sont consignés dans les logs du serveur, sans être renvoyés au client.

## Sécurité Keycloak

Le code FastAPI actuel ne contient pas de décodeur JWT ni de dépendance d'authentification sur les routes. Les instructions Keycloak précédentes ne correspondent pas à cette version du code ; une protection configurée sur la Gateway ne remplace pas la validation côté service si Order Service est exposé directement.

## Worker RabbitMQ

Les tests RabbitMQ et les anciennes instructions font référence à `app.messaging.rabbitmq` et `app.messaging.worker`, mais ces modules ne sont pas présents dans les sources actuelles. Aucun consommateur RabbitMQ exécutable n'est donc fourni par ce service dans cette version.
