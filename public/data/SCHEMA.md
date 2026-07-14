# Schéma `senators.json`

Source of truth : `notebooks/senat_ideal_point_model_R_simple.ipynb`  
Législature **2023–2026**. Modèle `pscl::ideal` d=2 (seed=123).

## Dimensions (notebook)

| Axe | Signification |
| --- | --- |
| `idealX` = dim1 pondérée | Gauche (CRC/SOC/GEST) → droite (UC/RTLI/UMP) |
| `idealY` = dim2 pondérée | Bas → proche présidente ; haut (RDPI) → loin / outer tiers |

Orientation notebook : flip dim1 si mean(left) > mean(right) ; **pas** de flip dim2.  
Poids APRE : dim1×1.0, dim2×0.564.

## Couverture

- Sénateurs : **348** (modèle 348)
- Scrutins : **3558**
- Données : `data/model_ready`

## Champs clés

| Champ | Signification |
| --- | --- |
| `party` / `groupe_code` | Code notebook (CRC…UMP) |
| `partyLabel` | Libellé court (RDPI pour LREM) |
| `partyColor` | Couleurs notebook |
| `idealX` / `idealY` | Coordonnées pondérées |
| `abstentionPct` | Taux d’abstention (0–100) |
| `distToGroup` | Distance au centroïde de groupe |
