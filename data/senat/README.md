# Ideal Point Sénat (réutilisé pour la comparaison)

Les sorties du modèle Sénat (`pscl::ideal`, même spécification que le notebook) sont reprises ici depuis `_recovery/` :

- `outputs/points_ideal_weighted_full.csv` — 348 sénateurs
- `outputs/ideal_model_d2.rds`
- `outputs/dimension_weights.csv`, `model_summary.csv`

Données brutes modèle : `../model_ready/` (`votes_senateurs_actifs.csv.gz`, etc.).

Pour refitter :

```bash
SENAT_MODEL_READY=$PWD/data/model_ready SENAT_OUT_DIR=$PWD/data/senat/outputs \
  /opt/anaconda3/envs/r_env/bin/Rscript _recovery/run_ideal_simple.R
```
