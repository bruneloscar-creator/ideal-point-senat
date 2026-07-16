# Ideal Point du Parlement français

Ce projet estime les positions de vote des parlementaires français avec un modèle Ideal Point bayésien, puis les représente dans deux maquettes 3D : le Sénat et l’Assemblée nationale.

[Ouvrir la visualisation 3D](https://ideal-point-senat-3d.aware-harp-9471.chatgpt.site)

[Méthode Sénat](https://ideal-point-senat-3d.aware-harp-9471.chatgpt.site/about.html) · [Méthode Assemblée nationale](https://ideal-point-senat-3d.aware-harp-9471.chatgpt.site/about-assemblee.html) · [Rapport Sénat](docs/Rapport_OSCAR_BRUNEL_positions_vote_Senat_IDEAL.pdf)

![Aperçu de la visualisation](public/og.png)

## Ce que montre le site

Le modèle apprend les proximités entre parlementaires à partir de leurs votes publics nominatifs. Deux personnes qui votent souvent de la même manière obtiennent des coordonnées proches. Ces coordonnées sont ensuite projetées sur les sièges de la maquette.

Le placement 3D ne reproduit donc pas le plan officiel des groupes politiques. Les sièges suivent les positions révélées par les votes.

Le site permet de :

- passer du Sénat à l’Assemblée nationale ;
- parcourir les 14e, 15e, 16e et 17e législatures de l’Assemblée ;
- rechercher un sénateur ou un député ;
- consulter sa position dans le nuage Ideal Point ;
- comparer son abstention, sa loyauté de groupe et sa distance au groupe ;
- explorer une scène adaptée aux ordinateurs et aux smartphones.

## Données disponibles

| Chambre | Période | Parlementaires dans le modèle | Scrutins retenus |
| --- | --- | ---: | ---: |
| Sénat | 2023 à 2026 | 348 | 3 558 |
| Assemblée nationale | 14e législature, 2012 à 2017 | 621 | 638 |
| Assemblée nationale | 15e législature, 2017 à 2022 | 640 | 3 466 |
| Assemblée nationale | 16e législature, 2022 à 2024 | 598 | 3 344 |
| Assemblée nationale | 17e législature, depuis 2024 | 575 | 7 410 |

Le nombre de parlementaires d’une législature peut dépasser le nombre de sièges lorsque plusieurs personnes se succèdent pendant la période. La maquette conserve toujours 348 sièges pour le Sénat et 577 pour l’Assemblée nationale.

## Modèle

La spécification commune est la suivante :

1. Les votes pour sont codés 1 et les votes contre 0.
2. Les abstentions et les absences sont traitées comme manquantes.
3. La part minoritaire d’un scrutin doit atteindre 10 %.
4. Un parlementaire doit disposer d’au moins 25 votes exprimés après filtrage.
5. `pscl::ideal` est estimé avec deux dimensions, 1 000 itérations, 500 itérations de rodage, un pas de 25 et la graine 123.
6. Le premier axe est orienté pour placer la gauche en valeurs négatives et la droite en valeurs positives.
7. Les dimensions sont pondérées par leur pouvoir explicatif APRE.

Une écriture simplifiée de la probabilité de vote est :

```text
P(vote pour) = Phi(beta' x_i - alpha)
```

`x_i` représente la position latente du parlementaire. Les paramètres du scrutin représentent sa difficulté et sa capacité à séparer les positions.

Pour l’Assemblée, les scripts utilisent des valeurs initiales SVD et des paramètres d’item nuls afin d’éviter une saturation mémoire sur les législatures comportant plusieurs milliers de scrutins. Le MCMC reste ensuite identique à la spécification du notebook.

## Lecture des axes

La dimension 1 correspond au principal clivage gauche droite observé dans les votes sélectionnés.

La dimension 2 ne doit pas être lue comme un second axe gauche droite. Au Sénat, elle capte notamment une position particulière du groupe RDPI. À l’Assemblée, elle distingue surtout la majorité des oppositions. Des groupes éloignés sur la dimension 1 peuvent donc être proches sur la dimension 2.

Exemple pour la 17e législature de l’Assemblée, moyenne de la dimension 1 :

| Groupe | Position moyenne approximative |
| --- | ---: |
| LFI-NFP | -0,77 |
| EcoS | -0,70 |
| SOC | -0,55 |
| GDR | -0,50 |
| EPR, DEM et HOR | +0,05 à +0,15 |
| DR | +0,35 |
| RN | +0,72 |

Ces valeurs sont relatives aux votes et à la période étudiés. Le zéro est le centre statistique du modèle, pas une définition universelle du centre politique.

## Notebooks

- [`notebooks/senat_ideal_point_model_R_simple.ipynb`](notebooks/senat_ideal_point_model_R_simple.ipynb) : source de vérité du modèle Sénat.
- [`notebooks/assemblee_ideal_point_model_R.ipynb`](notebooks/assemblee_ideal_point_model_R.ipynb) : notebook miroir pour l’Assemblée nationale.

## Organisation des données

| Chemin | Contenu |
| --- | --- |
| `data/model_ready/` | Tables Sénat utilisées par le notebook principal |
| `data/senat/outputs/` | Coordonnées et objets du modèle Sénat |
| `data/assemblee/raw/` | Archives officielles des scrutins, acteurs, mandats et organes |
| `data/assemblee/model_ready/` | Votes et métadonnées nettoyés par législature |
| `data/assemblee/outputs/l14/` à `l17/` | Coordonnées, matrices, diagnostics, résumés et graphiques |
| `data/comparison_senat_an/` | Législateurs-pont et alignement Procrustes Sénat vers Assemblée |
| `public/data/senators.json` | Export Sénat chargé par le site |
| `public/data/deputies/` | Manifeste et exports compacts L14 à L17 chargés à la demande |
| `public/data/deputies.json` | Export monolithique conservé pour analyse et compatibilité |

Les données Assemblée proviennent du portail [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/). Les données Sénat proviennent des publications publiques du Sénat. Leur réutilisation reste soumise aux conditions de leurs portails respectifs.

Le détail du contenu se trouve dans :

- [`data/README.md`](data/README.md)
- [`data/assemblee/README.md`](data/assemblee/README.md)
- [`data/comparison_senat_an/README.md`](data/comparison_senat_an/README.md)
- [`public/data/SCHEMA.md`](public/data/SCHEMA.md)
- [`public/data/DEPUTIES_SCHEMA.md`](public/data/DEPUTIES_SCHEMA.md)

## Reproduire le Sénat

Prérequis R : `tidyverse` et `pscl`.

```bash
gunzip -k data/model_ready/votes_senateurs_actifs.csv.gz
Rscript _recovery/run_ideal_notebook.R
python3 scripts/build_json_from_ideal.py
```

## Reproduire l’Assemblée nationale

```bash
python3 scripts/assemblee/download_an_data.py
python3 scripts/assemblee/build_clean_dataset.py
bash scripts/assemblee/run_all_ideal.sh
python3 scripts/assemblee/build_deputies_json.py
```

Le pipeline produit les estimations L14 à L17. Les données nominatives nécessaires à la 13e législature ne sont pas disponibles dans le dump officiel utilisé par le projet.

## Comparer les deux chambres

La comparaison utilise les parlementaires ayant siégé dans les deux chambres comme points d’ancrage. Une transformation Procrustes aligne l’espace de l’Assemblée sur celui du Sénat.

```bash
python3 scripts/assemblee/build_bridge_senat_an.py
python3 scripts/assemblee/align_senat_an.py
```

Sur les ponts de la 14e législature, la corrélation de la dimension 1 est proche de 0,89. La dimension 2 n’est pas comparable directement entre les deux chambres.

## Application 3D

Le frontend utilise Vite et Three.js. Les coordonnées du modèle sont déjà calculées dans les fichiers JSON. Le navigateur ne réestime jamais le modèle statistique.

Pour limiter le chargement, l’Assemblée récupère un manifeste léger puis uniquement la législature sélectionnée. Les autres périodes sont chargées au clic et conservées dans le cache du navigateur.

```bash
npm install
npm run dev
```

Build de production :

```bash
npm run build
```

## Structure du code

| Chemin | Rôle |
| --- | --- |
| `index.html` | Interface, introduction, recherche et fiches |
| `about.html` | Méthode et références du Sénat |
| `about-assemblee.html` | Méthode et références de l’Assemblée |
| `src/main.js` | Scène 3D, sièges, données, périodes et interactions |
| `src/idealScatter.js` | Nuages Ideal Point partagés |
| `assemblee nationale 3D/` | Géométrie et thème de l’Assemblée |
| `scripts/assemblee/` | Collecte, préparation, estimation et comparaison |
| `vite.config.js` | Build multi-page et préparation des données du site |

## Limites

- Le modèle décrit les votes publics sélectionnés, pas toute l’idéologie d’une personne.
- La discipline de groupe et l’ordre du jour influencent les positions estimées.
- Les abstentions et absences ne sont pas utilisées comme votes pour ou contre.
- Les espaces de législatures différentes sont estimés séparément.
- La dimension 2 change de sens politique selon la chambre et la période.
- La position 3D est une projection analytique et non un plan de placement officiel.

## Références

Les références méthodologiques et les sources sont regroupées dans [`REFERENCES.md`](REFERENCES.md).

## Auteur

Oscar Brunel

[LinkedIn](https://www.linkedin.com/in/oscar-brunel-624657334/) · [bruneloscar@gmail.com](mailto:bruneloscar@gmail.com)

Ce dépôt ne contient pas de licence générale pour le code. Les jeux de données et les éléments visuels externes restent soumis aux conditions de leurs sources.
