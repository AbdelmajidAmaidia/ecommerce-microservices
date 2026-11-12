# Journal des prompts et décisions

## Prompt appliqué

- Migration complète de la persistance du service de paiement de PostgreSQL/JPA vers MongoDB, sans retirer les fonctionnalités REST et métier existantes.

## Modifications réalisées

- Remplacement de Spring Data JPA, PostgreSQL et H2 par Spring Data MongoDB ; ajout de Testcontainers MongoDB pour les tests d'intégration.
- Migration de `Payment` vers `@Document(collection = "payments")`, avec identifiant String compatible ObjectId et maintien séparé de `orderId`.
- Configuration par `MONGODB_URI`, par défaut `mongodb://localhost:27017/payment_db`.
- Ajout d'un index unique partiel sur `idempotencyKey`, avec traduction d'une collision MongoDB en conflit métier HTTP 409.
- Adaptation du service, repository, API, documentation OpenAPI, erreurs et tests à l'identifiant MongoDB et au repository Mongo.
- Mise à jour du guide Windows et des étapes Compass dans le README.

## Décisions techniques

- `orderId` reste un `Long` métier ; seul l'identifiant du paiement devient une chaîne ObjectId.
- Le montant continue de provenir de `OrderClient`, et les scénarios fictifs 1001, 1002 et paiement à livraison sont conservés.
- `createdAt` et `updatedAt` sont renseignés par l'entité, et `updatedAt` est avancé lors d'une transition d'état.
- L'index ignore les valeurs nulles ou absentes grâce à un filtre partiel de type chaîne ; l'API refuse les clés vides.
- Les tests d'intégration préfèrent Docker/Testcontainers ; sans Docker, ils utilisent `PAYMENT_TEST_MONGODB_URI` ou la base dédiée locale `payment_test_db`. Ils ne se rabattent jamais sur H2.

## Tests et vérifications

- Environnement constaté pendant la migration : Maven, Docker, `mongod`, `mongosh` et MongoDB Compass ne sont pas détectés ; le port `localhost:27017` n'est pas joignable.
- Les tests Maven, la création de l'index dans une vraie instance MongoDB et le démarrage du service restent à exécuter dans un environnement disposant de Maven et de Docker ou d'une instance MongoDB dédiée.
- Ne pas présenter la migration comme vérifiée contre un serveur MongoDB tant que l'index et la connexion n'ont pas été observés.

## Corrections humaines

- Aucune à ce stade.
