# NoteIt pour iPad

L'application Notely (notes et tâches) en version iPad, compilée sur un Mac de GitHub Actions et installée avec Sideloadly et un compte Apple gratuit.

## Ce qu'il y a dedans

- `NoteIt/Web/index.html` : l'application elle-même (la même que le prototype), en plein écran sur 3 colonnes : listes, tâches, note. Polices incluses, fonctionne hors ligne.
- `NoteIt/Sources/` : une petite coque iOS (Swift) qui affiche la page et enregistre les données dans un fichier de l'app (`Documents/notely-store.json`).
- `project.yml` : la description du projet Xcode, générée sur le Mac de GitHub par XcodeGen.
- `.github/workflows/ipad.yml` : compile un `NoteIt.ipa` non signé à chaque push sur `main`, ou à la demande.

iPadOS 16.4 ou plus récent.

## Installer sur l'iPad

1. Sur GitHub, onglet **Actions**, ouvrir le dernier **Build iPad (.ipa non signé)** réussi (ou **Run workflow** pour en lancer un).
2. En bas de la page, télécharger **NoteIt-ipa**, puis dézipper : on obtient `NoteIt.ipa`.
3. Brancher l'iPad au PC en USB, le déverrouiller et accepter « Faire confiance à cet ordinateur ».
4. Ouvrir **Sideloadly**, choisir l'iPad, glisser `NoteIt.ipa`, saisir son identifiant Apple, puis **Start**.
5. Sur l'iPad : **Réglages > Général > VPN et gestion de l'appareil**, toucher son identifiant Apple puis **Faire confiance**.
6. Si l'iPad le demande (iPadOS 16+) : **Réglages > Confidentialité et sécurité > Mode développeur**, l'activer et redémarrer.

## Limites du compte Apple gratuit

- L'app expire au bout de **7 jours** : il suffit de refaire l'étape 4 (ou d'activer le rafraîchissement automatique de Sideloadly). Les données restent, tant que l'app n'est pas supprimée.
- 3 apps installées ainsi au maximum par appareil, et 10 identifiants d'app créés par semaine.

## Assistant IA (ChatGPT)

Le bouton micro en bas à droite ouvre un petit chat, au clavier ou à la voix, qui agit sur l'app : créer une section, ajouter ou reporter une tâche, cocher, préparer un brouillon de mail. Chaque série d'actions peut être annulée depuis le chat.

- Il faut une clé personnelle OpenAI (`sk-…`), créée sur platform.openai.com. Un guide illustré s'affiche au premier appui sur le micro. L'API est facturée à l'usage, à part de ChatGPT Plus.
- La clé est rangée dans le trousseau iOS (`Keychain.swift`). Les requêtes partent du code natif (`AIProvider.swift`), la page ne revoit jamais la clé.
- La dictée utilise la reconnaissance vocale d'iOS en français (`SpeechInput.swift`). iPadOS demande l'accès au micro et à la reconnaissance vocale la première fois.
- Le code est prévu pour ajouter Claude plus tard : un fournisseur de plus dans `PROVIDERS` (index.html) et dans `AIProvider.all`.
