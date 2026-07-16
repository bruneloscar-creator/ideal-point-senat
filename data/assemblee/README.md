# Données Assemblée Nationale — Ideal Point (multi-législatures)

Pipeline parallèle au modèle Sénat (`pscl::ideal`), sur les scrutins publics nominatifs.

## Sources

Portail : [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/)

| Fichier (`raw/`) | Législature |
| --- | --- |
| `Scrutins_14.json.zip` … `Scrutins_17.json.zip` | 14e–17e |
| `AMO10_*`, `AMO20_*`, `AMO30_historique.json.zip` | Acteurs / mandats / organes |

**13e législature :** aucun dump `Scrutins` n’est publié dans le dépôt open data (404 sur les variantes `XIII`). Le téléchargeur le tente puis continue. Dès qu’un `Scrutins_13.json.zip` est ajouté dans `raw/`, `build_clean_dataset.py` et le pipeline Ideal le prendront en charge.

```bash
python3 scripts/assemblee/download_an_data.py
python3 scripts/assemblee/build_clean_dataset.py
```

## Ideal Point — toutes les législatures disponibles

Spécification (identique au notebook Sénat / L17) :

- pour/contre uniquement ; minority ≥ 10 % ; ≥ 25 votes / député
- `pscl::ideal` d=2, maxiter=1000, burnin=500, thin=25, impute=FALSE, seed=123
- start values SVD + paramètres d’item nuls (évite OOM GLM)
- orientation dim1 via groupes gauche/droite (`legislature_config.json`)
- pondération APRE des axes

```bash
# Tout enchaîner (L14–L17 par défaut)
bash scripts/assemblee/run_all_ideal.sh

# Ou une législature
python3 scripts/assemblee/prepare_rollcall.py --legislature 14
AN_LEGISLATURE=14 AN_OUT_DIR=$PWD/data/assemblee/outputs/l14 \
  /opt/anaconda3/envs/r_env/bin/Rscript scripts/assemblee/run_ideal.R 14
python3 scripts/assemblee/postprocess_ideal.py --legislature 14
```

Sorties : `data/assemblee/outputs/l14/` … `l17/`
(`points_ideal_weighted_full.csv`, plots, `ideal_model_lXX.rds`, etc.)

## Comparaison Sénat ↔ AN

Voir [`../comparison_senat_an/README.md`](../comparison_senat_an/README.md).

Notebook miroir : [`notebooks/assemblee_ideal_point_model_R.ipynb`](../../notebooks/assemblee_ideal_point_model_R.ipynb)
