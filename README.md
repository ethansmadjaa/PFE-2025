# PFE-2025

## Description

Projet de fin d'études 2025 - Application de génération audio à partir d'images utilisant FastAPI et des modèles Ollama.

## Prérequis

- Python 3.x
- UV (gestionnaire de paquets Python moderne)
- Docker et Docker Compose (optionnel)
- Ollama (pour les modèles d'IA)

## Installation

## Lancement

### Option 1 : Exécution locale

#### Démarrer l'application principale

## Installation des modèles Ollama

Avant de démarrer l'application, installez les modèles Ollama nécessaires :

```bash
ollama run llama3.2
ollama run llama3.2-vision
```

### Installation des dépendances Python

1. **Installer UV**

   ```bash
   pip install uv
   ```

2. **Synchroniser les dépendances**

   ```bash
   uv sync
   ```

```bash
uv run main.py
```

#### Exécuter les tests

Dans un terminal séparé, lancez :

```bash
uv run test.py
```

### Option 2 : Exécution avec Docker

1. **Premier lancement** (avec construction de l'image)

   ```bash
   docker-compose up --build
   ```

2. **Lancements suivants**

   ```bash
   docker-compose up
   ```

## Structure du Projet

```plaintext
PFE-2025/
├── main.py          # Point d'entrée de l'application
├── test.py          # Script de tests
└── README.md        # Ce fichier
```
