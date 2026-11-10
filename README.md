\# E-commerce Microservices Project



\## Présentation



Projet académique de développement d'une application e-commerce basée sur une architecture microservices.



L'objectif est de séparer les responsabilités de gestion des commandes et des paiements, tout en permettant la communication entre les services.



\## Architecture



| Service | Technologie | Port |

|---|---|---|

| Eureka Server | Spring Boot / Spring Cloud Netflix Eureka | 8761 |

| API Gateway | Spring Cloud Gateway | 8080 |

| Order Service | FastAPI / Python / MySQL | 8085 |

| Payment Service | Spring Boot / MongoDB | 8084 |



\## Fonctionnalités



\- Gestion des commandes

\- Gestion des paiements simulés

\- Communication REST entre Order Service et Payment Service

\- Découverte des microservices avec Eureka

\- Routage centralisé avec API Gateway

\- Gestion des erreurs HTTP

\- Tests automatisés



\## Architecture de communication



Le client communique avec API Gateway.



API Gateway utilise Eureka pour découvrir les microservices et router les requêtes.



Order Service gère les commandes et utilise MySQL.



Payment Service gère les paiements et utilise MongoDB.



Payment Service récupère les informations de commande auprès de Order Service avant de traiter un paiement.



\## Ports



\- Eureka Server : 8761

\- API Gateway : 8080

\- Order Service : 8085

\- Payment Service : 8084



\## Technologies



\- Java 21

\- Spring Boot

\- Spring Cloud

\- Spring Cloud Gateway

\- Eureka

\- FastAPI

\- MySQL

\- MongoDB

\- Maven

\- Python

\- Git / GitHub



\## Installation et démarrage



Les instructions détaillées de démarrage des services seront ajoutées après validation de l'architecture complète.



\## Auteur



Projet académique - Architecture Microservices E-commerce.

