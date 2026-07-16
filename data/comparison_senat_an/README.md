# Comparaison Ideal Point — Sénat ↔ Assemblée nationale

## Objectif

Comparer les positions latentes (`pscl::ideal`, d=2) des sénateurs actuels et des députés, en ancrant les deux espaces via les **législateurs-pont** (sénateurs d’aujourd’hui ayant siégé à l’Assemblée).

## Données & appariement

1. **Sénateurs actuels** : `data/model_ready/senateurs_actifs.csv` (348).
2. **Historique AMO30** : acteurs avec mandat `SENAT` ouvert **et** ≥1 mandat `ASSEMBLEE`.
3. **Appariement** : `(prénom, nom)` normalisés (accents retirés). Les 26 candidats AMO matchent de façon unique les matricules Sénat (pas d’homonyme bloquant dans cet extrait). La date de naissance AMO est conservée pour audit.
4. **Filtre Congrès** : la présence d’un `acteur_id` sénatorial dans un fichier de votes AN ne suffit pas (votes isolés du Congrès). On exige un **mandat Assemblée** sur la législature **et** ≥25 votes pour/contre.

Script : `scripts/assemblee/build_bridge_senat_an.py`

## Législature AN retenue

Voir `chosen_legislature.json`. Critère : maximiser le nombre de sénateurs actuels éligibles avec données de votes disponibles.

En pratique : **14e législature** (≈17 ponts avec ≥25 votes), devant la 15e (6). Les mandats L12/L13 existent dans AMO mais **aucun dump officiel de scrutins nominatifs L13** n’est publié sur `data.assemblee-nationale.fr` (HTTP 404) ; NosDéputés 2007–2012 n’expose pas non plus de votes nominatifs. Impossible de fitter un Ideal Point L13 sans nouvelle source.

## Alignement des espaces (Procrustes)

Script : `scripts/assemblee/align_senat_an.py`

Méthode : **Procrustes de similarité** (translation + échelle isotrope + rotation/réflexion orthogonale) estimée sur les ponts, qui envoie les coordonnées AN → espace Sénat.

Soit \(X\) les coordonnées AN des ponts et \(Y\) leurs coordonnées Sénat :

1. Centrer \(X\) et \(Y\).
2. Rotation de Kabsch \(R\) via SVD de \(X_c^\top Y_c\) (réflexion autorisée).
3. Échelle \(s = \mathrm{tr}(\Sigma) / \|X_c\|_F^2\).
4. Translation \(t = \mu_Y - s\,\mu_X R\).

Diagnostics : RMSE in-sample, RMSE leave-one-out, corrélations dim1/dim2 après alignement. On utilise les coordonnées **raw** (avant poids APRE) pour l’ancrage, plus comparables d’une chambre à l’autre ; les nuages complets AN sont ensuite projetés dans l’espace Sénat.

## Reproduire

```bash
# 1) Données AN (L14–L17 ; L13 tenté puis ignoré si absent)
python3 scripts/assemblee/download_an_data.py
python3 scripts/assemblee/build_clean_dataset.py

# 2) Ideal Point multi-législatures
bash scripts/assemblee/run_all_ideal.sh
# ou législature par législature :
#   python3 scripts/assemblee/prepare_rollcall.py --legislature 14
#   AN_LEGISLATURE=14 AN_OUT_DIR=$PWD/data/assemblee/outputs/l14 \
#     /opt/anaconda3/envs/r_env/bin/Rscript scripts/assemblee/run_ideal.R 14
#   python3 scripts/assemblee/postprocess_ideal.py --legislature 14

# 3) Ponts + alignement (nécessite fit AN L14 + points Sénat)
python3 scripts/assemblee/build_bridge_senat_an.py
python3 scripts/assemblee/align_senat_an.py
```

Sorties Sénat réutilisées : `data/senat/outputs/points_ideal_weighted_full.csv` (copie du fit notebook / `_recovery`).

## Fichiers produits

| Fichier | Contenu |
| --- | --- |
| `bridge_candidates_amo.csv` | Candidats AMO (SENAT actif ∩ ASSEMBLEE) |
| `bridge_overlap_by_legislature.csv` | Détail par personne × législature |
| `overlap_summary_by_legislature.csv` | Comptages agrégés |
| `chosen_legislature.json` | Choix + rationnel |
| `bridge_legislators_l14.csv` | Ponts éligibles L14 |
| `bridge_mapped_l14.csv` | Coordonnées natives + alignées + résidus |
| `an_l14_points_in_senate_space.csv` | Tous les députés L14 projetés |
| `procrustes_diagnostics_l14.json` | Paramètres / RMSE / corrélations |
| `plot_alignment_l14.png` | Avant / après alignement |
| `plot_bridge_dim1_l14.png` | Comparaison 1D des ponts |
| `interpretation_l14.md` | Lecture courte |
