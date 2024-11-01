# Obsidian Image Generator Plugin

Ce plugin permet de générer des images à partir de descriptions textuelles directement dans Obsidian, en utilisant l'API Replicate.

## Fonctionnalités

- Génération d'images à partir de descriptions textuelles
- Personnalisation des dimensions d'image
- Sauvegarde automatique dans un dossier dédié
- Interface utilisateur intuitive

## Installation

### Depuis le Community Plugins

1. Ouvrez Obsidian
2. Allez dans Paramètres → Plugins communautaires → Parcourir
3. Recherchez "Image Generator"
4. Cliquez sur Installer
5. Activez le plugin dans l'onglet Plugins installés

### Installation manuelle

1. Créez un dossier `.obsidian/plugins/image-generator/` dans votre vault
2. Téléchargez les fichiers `main.js`, `manifest.json` et `styles.css`
3. Placez les fichiers dans le dossier créé
4. Redémarrez Obsidian
5. Activez le plugin dans Paramètres → Plugins communautaires

## Configuration

1. Obtenez un token API sur [Replicate](https://replicate.com/account)
2. Dans Obsidian, allez dans Paramètres → Image Generator
3. Collez votre token API
4. Configurez les dimensions par défaut souhaitées

## Utilisation

1. Utilisez la commande "Generate Image" depuis la palette de commandes (Ctrl/Cmd + P)
2. Entrez une description de l'image souhaitée
3. Ajustez les dimensions si nécessaire
4. Cliquez sur Générer

## Développement

```bash
# Cloner le repository
git clone https://github.com/votre-nom/obsidian-image-generator

# Installer les dépendances
npm install

# Compiler
npm run build
```

## License

[MIT](LICENSE)
