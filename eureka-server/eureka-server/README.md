# Eureka Server

Serveur de découverte des microservices e-commerce, basé sur Spring Boot 3.4.5,
Spring Cloud 2024.0.2 et Java 21. Le train Spring Cloud 2024.0.x est compatible
avec Spring Boot 3.4.x.

## Prérequis

- JDK 21 (ou une version compatible avec Spring Boot 3.4.5)
- Maven 3.6.3 ou supérieur, sauf si le Maven Wrapper est disponible

## Lancement sous Windows

Depuis le dossier du projet, avec Maven installé :

```powershell
mvn spring-boot:run
```

Si le Maven Wrapper est disponible, lancez plutôt :

```powershell
.\mvnw.cmd spring-boot:run
```

Le serveur démarre sur le port `8761` et ne s'enregistre pas lui-même comme
client Eureka ; il ne récupère pas non plus de registre auprès d'un autre serveur.

## Vérification

Ouvrez <http://localhost:8761> dans un navigateur. Le tableau de bord Eureka
doit s'afficher. Pour vérifier le registre depuis PowerShell :

```powershell
Invoke-WebRequest -Uri http://localhost:8761/eureka/apps -Headers @{ Accept = "application/json" }
```

Le registre doit être vide tant qu'aucun microservice client n'est configuré.

## Tests et paquet

Avec Maven installé :

```powershell
mvn clean test
mvn clean package
```

Avec le Maven Wrapper, remplacez `mvn` par `.\mvnw.cmd`.
