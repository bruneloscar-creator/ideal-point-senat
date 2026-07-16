# Schéma `deputies.json`

Assemblée nationale — Ideal Point multi-législatures.

## Périodes

Slider sur L14–L17 (dates officielles + plage de scrutins du modèle).

| id | Législature | Dates officielles |
| --- | --- | --- |
| l14 | 14e | 2012-06-20 → 2017-06-20 |
| l15 | 15e | 2017-06-21 → 2022-06-21 |
| l16 | 16e | 2022-06-22 → 2024-06-09 |
| l17 | 17e | 2024-07-18 → … |

Fitted in this export: l14, l15, l16, l17.
Missing: (none).

## Champs député

Même forme que `senators.json` (`idealX`/`idealY`, `partyColor`, métriques,
`circonscription`, `avatar`, `url` → assemblee-nationale.fr).

## Chargement du site

Le site charge `deputies/manifest.json`, puis uniquement le fichier compact de
la législature sélectionnée (`deputies/l14.json` … `deputies/l17.json`). Le
fichier monolithique reste disponible pour les analyses et la compatibilité.
