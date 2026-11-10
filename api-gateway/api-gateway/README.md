# API Gateway

Passerelle reactive Spring Cloud Gateway pour les microservices e-commerce.

## Versions et dépendances

- Java 21
- Spring Boot 3.4.5
- Spring Cloud 2024.0.3 (BOM `2024.0.x`, compatible avec Spring Boot 3.4.x)
- Spring Cloud Gateway WebFlux, Eureka Discovery Client et Spring Cloud LoadBalancer
- Spring Boot Actuator

La passerelle utilise le starter Gateway réactif et ne dépend pas de Spring MVC.

## Démarrer

Depuis le dossier du projet, avec le serveur Eureka disponible sur `http://localhost:8761` :

```shell
mvn test
mvn spring-boot:run
```

Le service démarre sur le port `8080`, s'enregistre dans Eureka sous le nom `API-GATEWAY` et récupère son registre.
La vérification de santé est disponible sur `http://localhost:8080/actuator/health`.

## Routage et tests Postman

Les routes utilisent le nom de service Eureka avec le préfixe `lb://`, afin que Spring Cloud LoadBalancer sélectionne une instance enregistrée. Aucun filtre de réécriture ou de suppression de préfixe n'est configuré : le chemin reçu est transmis tel quel au service.

| Chemin envoyé à la passerelle | Service Eureka |
| --- | --- |
| `http://localhost:8080/api/orders/**` | `lb://ORDER-SERVICE` |
| `http://localhost:8080/api/payments/**` | `lb://PAYMENT-SERVICE` |

Dans Postman, créez une requête avec la méthode, le corps et les en-têtes attendus par l'API du service, puis remplacez l'URL de base du service par `http://localhost:8080`. Par exemple, envoyez une requête vers `http://localhost:8080/api/orders/<chemin-de-votre-endpoint>` ou `http://localhost:8080/api/payments/<chemin-de-votre-endpoint>`. Les segments après `/api/orders` ou `/api/payments` doivent correspondre aux endpoints réels des services.

Eureka doit afficher l'instance `API-GATEWAY` sur `http://localhost:8761`. On peut également consulter son enregistrement via `http://localhost:8761/eureka/apps/API-GATEWAY`. La présence dans Eureka confirme l'enregistrement de la passerelle, mais le routage nécessite aussi que les instances `ORDER-SERVICE` et `PAYMENT-SERVICE` soient disponibles dans le registre.
