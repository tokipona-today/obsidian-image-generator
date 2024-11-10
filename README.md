# Obsidian Image Generator Plugin

Ce plugin permet de générer des images à partir de descriptions textuelles directement dans Obsidian, en utilisant l'API Replicate avec les modèles FLUX.

## Fonctionnalités

- Génération d'images de haute qualité avec le modèle Flux Schnell
- Dimensions d'image personnalisables (par défaut : 1024x400)
- Interface utilisateur intuitive intégrée à Obsidian
- Sauvegarde automatique dans un dossier dédié
- Insertion automatique du markdown dans vos notes

## Pourquoi Flux Schnell ?

Flux Schnell est un modèle optimisé pour :
- La génération rapide d'images
- Une qualité visuelle correcte
- Une bonne interprétation des prompts en français
- Des résultats cohérents et stables
- Une large variété de styles artistiques

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

1. Créez un compte sur [Replicate](https://replicate.com/signup) si vous n'en avez pas
2. Obtenez votre token API sur [votre page compte](https://replicate.com/account)
3. Dans Obsidian, allez dans Paramètres → Image Generator
4. Configurez :
   - Votre token API Replicate
   - Les dimensions par défaut des images (optionnel)

## Utilisation

1. Dans une note Obsidian, utilisez la palette de commandes (Ctrl/Cmd + P)
2. Recherchez "Generate Image"
3. Dans la fenêtre qui s'ouvre :
   - Entrez une description détaillée de l'image souhaitée
   - Ajustez les dimensions si nécessaire (64-2048 pixels)
   - Cliquez sur Générer

### Conseils pour de meilleurs résultats

1. Soyez précis dans vos descriptions
2. Spécifiez le style souhaité (ex: "style photorealistic", "style anime", "digital art")
3. Ajoutez des détails sur l'ambiance (ex: "dramatic lighting", "bright colors")
4. Mentionnez la perspective si importante (ex: "front view", "aerial view")

### Exemples de prompts

```
Une forêt mystérieuse au coucher du soleil, style digital art, couleurs vibrantes, vue en perspective
```

```
Portrait d'un chat persan blanc, style photorealistic, gros plan, éclairage studio professionnel
```

## Développement

```bash
# Cloner le repository
git clone https://github.com/votre-nom/obsidian-image-generator

# Installer les dépendances
npm install

# Compiler
npm run build
```

### Structure du projet

```
.
├── src/
│   └── main.ts
├── manifest.json
├── package.json
├── README.md
└── LICENSE
```

### Contributions

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

### Dépannage

**Q: Les images ne se génèrent pas**
- Vérifiez votre token API
- Assurez-vous d'avoir des crédits Replicate disponibles
- Vérifiez votre connexion internet

**Q: Les dimensions ne fonctionnent pas**
- Les dimensions doivent être entre 64 et 2048 pixels
- Les dimensions doivent être des nombres entiers multiples de 4

## Crédits

- Modèle d'IA : [Flux Schnell](https://replicate.com/flux-schnell)
- API : [Replicate](https://replicate.com)

## License

[MIT](LICENSE) © [Nikos Prinio]

## Support

Si vous rencontrez des problèmes ou avez des questions :
1. Consultez les [Issues GitHub](https://github.com/votre-nom/obsidian-image-generator/issues)
2. Créez une nouvelle issue si nécessaire
3. Rejoignez la discussion sur le [forum Obsidian](https://forum.obsidian.md)
