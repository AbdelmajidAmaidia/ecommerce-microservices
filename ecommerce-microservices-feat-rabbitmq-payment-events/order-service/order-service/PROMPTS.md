# Prompts et périmètre de démonstration

## Demande initiale

Créer dans ce dossier un microservice Order Service avec Python 3, FastAPI, SQLAlchemy 2, MySQL/PyMySQL, Pydantic, Uvicorn et Pytest. Implémenter la création, la consultation, la pagination et le filtrage de commandes, les transitions de statut, l'annulation, les commandes par client et le calcul exact du montant. Fournir une configuration par environnement, des tables distinctes pour les commandes et leurs lignes, une documentation d'installation PowerShell, des exemples HTTP et des tests sur une base distincte.

## Hypothèses de cette version

- Les statuts suivent un flux simple documenté dans `README.md`; seules les transitions listées sont acceptées.
- Les prix sont fournis par la requête à des fins de démonstration. Une version de production doit les vérifier auprès du service Produits.
- L'endpoint de lecture expose `id`, `total_amount`, `currency` et `status`, mais le contrat du `OrderClient` du Payment Service reste à confirmer avant intégration.
- Les tables sont créées par la commande explicite `python -m app.init_db`. La base MySQL doit préexister.
- La suite Pytest utilise SQLite en mémoire et ne se connecte jamais à la base de développement.
