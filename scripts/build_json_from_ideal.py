#!/usr/bin/env python3
"""Build public/data/senators.json from notebook-equivalent Ideal Point export."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REC = ROOT / "_recovery"
OUT_JSON = ROOT / "public" / "data" / "senators.json"
OUT_SCHEMA = ROOT / "public" / "data" / "SCHEMA.md"
NOTEBOOK = "notebooks/senat_ideal_point_model_R_simple.ipynb"
DATA_FOLDER = "data/model_ready"

GROUP_COLORS = {
    "CRC": "#B2182B",
    "GEST": "#D6604D",
    "SOC": "#EF8A62",
    "RDSE": "#FDB863",
    "LREM": "#A6D96A",
    "NI": "#999999",
    "UC": "#67A9CF",
    "RTLI": "#2166AC",
    "UMP": "#762A83",
}
GROUP_ORDER = ["CRC", "GEST", "SOC", "RDSE", "LREM", "NI", "UC", "RTLI", "UMP"]


def fnum(row, k, nd=4):
    v = row.get(k)
    if v is None or v == "":
        return None
    return round(float(v), nd)


def fpct(row, k):
    v = row.get(k)
    if v is None or v == "":
        return None
    return round(float(v) * 100, 1)


def fint(row, k):
    v = row.get(k)
    if v is None or v == "":
        return None
    return int(float(v))


def main():
    points_path = REC / "points_ideal_weighted_full.csv"
    summary_path = REC / "model_summary.csv"
    if not points_path.exists():
        raise SystemExit(f"Missing {points_path} — run Ideal R script first")

    with summary_path.open(encoding="utf-8") as f:
        summary = next(csv.DictReader(f))

    dim1_m = float(summary["dim1_multiplier"])
    dim2_m = float(summary["dim2_multiplier"])
    n_model = int(float(summary["model_senators"]))
    n_rc = int(float(summary["model_roll_calls"]))

    senators = []
    with points_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("groupe_code") or "").strip()
            lib = (row.get("groupe_libelle_court") or "").strip()
            close = str(row.get("close_to_group") or "").upper() in ("TRUE", "1", "T")
            far = str(row.get("far_from_group") or "").upper() in ("TRUE", "1", "T")
            label = row.get("distance_to_group_label") or None
            url = (row.get("url") or "").strip() or None
            avatar = (row.get("url_avatar") or "").strip() or None
            siege = row.get("siege")
            siege_val = None if siege in (None, "") else int(float(siege))

            senators.append(
                {
                    "id": row["matricule"].upper(),
                    "matricule": row["matricule"].upper(),
                    "name": row.get("full_name")
                    or f"{row.get('prenom', '')} {row.get('nom', '')}".strip(),
                    "nom": row.get("nom") or None,
                    "prenom": row.get("prenom") or None,
                    "party": code,
                    "partyLabel": lib,
                    "groupe_code": code or None,
                    "groupe_libelle": lib or None,
                    "parti": "RDPI" if code == "LREM" else lib,
                    "groupe": "RDPI" if code == "LREM" else lib,
                    "partyColor": GROUP_COLORS.get(code, "#999999"),
                    "idealX": fnum(row, "dim1", 4),
                    "idealY": fnum(row, "dim2", 4),
                    "idealX_raw": fnum(row, "dim1_raw", 4),
                    "idealY_raw": fnum(row, "dim2_raw", 4),
                    "abstentionPct": fpct(row, "abstention_rate"),
                    "nonVotingPct": fpct(row, "non_voting_rate"),
                    "yesNoShare": fnum(row, "yes_no_share", 3),
                    "yesNoSharePct": fpct(row, "yes_no_share"),
                    "totalPublicVotes": fint(row, "total_public_votes"),
                    "yesVotes": fint(row, "yes_votes"),
                    "noVotes": fint(row, "no_votes"),
                    "abstentions": fint(row, "abstentions"),
                    "nonVoting": fint(row, "non_voting"),
                    "distToGroup": fnum(row, "distance_to_group_center", 3),
                    "farFromGroup": far,
                    "closeToGroup": close,
                    "distanceToGroupLabel": label,
                    "groupLoyaltyPct": fpct(row, "group_loyalty_rate"),
                    "votesAgainstGroup": fint(row, "votes_against_group"),
                    "votesWithGroup": fint(row, "votes_with_group"),
                    "yesNoVotesWithGroupMajority": fint(
                        row, "yes_no_votes_with_group_majority"
                    ),
                    "rankInGroupLeftToRight": fnum(row, "rank_left_to_right", 1),
                    "percentileInGroupLeftToRight": fnum(
                        row, "percentile_left_to_right", 3
                    ),
                    "rankMostLoyalInGroup": fnum(row, "rank_most_loyal_in_group", 1),
                    "rankAbstentionInGroup": fnum(row, "rank_abstention_in_group", 1),
                    "groupMembers": fint(row, "group_members"),
                    "groupDim1Mean": fnum(row, "group_dim1_mean", 3),
                    "groupDim2Mean": fnum(row, "group_dim2_mean", 3),
                    "distanceToSamantha1d": fnum(row, "distance_to_samantha_1d", 3),
                    "circonscription": row.get("circonscription_libelle") or None,
                    "url": url,
                    "avatar": avatar,
                    "siege": siege_val,
                    "coordsSource": (
                        "points_ideal_weighted from "
                        "senat_ideal_point_model_R_simple.ipynb pipeline"
                    ),
                    "legislature": "2023-2026",
                    "idealImputed": False,
                    "idealRankLeftToRight": fint(row, "ideal_rank_left_to_right"),
                }
            )

    senators.sort(
        key=lambda s: (
            s["idealX"] is None,
            s["idealX"] if s["idealX"] is not None else 0,
            s["name"] or "",
        )
    )
    for i, s in enumerate(senators):
        if s["idealX"] is not None:
            s["idealRankLeftToRight"] = i + 1

    payload = {
        "meta": {
            "notebook": NOTEBOOK,
            "legislature": "2023-2026",
            "source": (
                "Notebook-faithful weighted Ideal Point from "
                "_recovery/points_ideal_weighted_full.csv "
                "(senat_ideal_point_model_R_simple.ipynb pipeline: "
                "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25, "
                "notebook orientation/scale; NOT ideal_point_r export)"
            ),
            "sourceCoords": "_recovery/points_ideal_weighted_full.csv",
            "sourceNotebook": "senat_ideal_point_model_R_simple.ipynb",
            "data_folder": DATA_FOLDER,
            "model": "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25",
            "filters": {
                "vote_values": [1, -1],
                "minority_share_min": 0.10,
                "min_votes_per_senator": 25,
            },
            "orientation": {
                "dim1": (
                    "Flip so mean(SOC,CRC,GEST) < mean(UMP,UC,RTLI); "
                    "negative = gauche, positive = droite"
                ),
                "dim2": (
                    "No sign flip in notebook; RDPI (LREM) high = haut on plot; "
                    "3D: haut/loin outer tiers, bas/proche présidente"
                ),
                "scale": "Unit disk radius max(sqrt(dim1^2+dim2^2))",
                "weights": {
                    "dim1": dim1_m,
                    "dim2": dim2_m,
                    "source": "notebook cell 14 APRE coordinate_multiplier",
                },
            },
            "n_senators_in_model": n_model,
            "n_rollcalls_in_model": n_rc,
            "n_senators_exported": len(senators),
            "count": len(senators),
            "group_order": GROUP_ORDER,
            "group_colors": GROUP_COLORS,
            "dimension_multipliers": {"dim1": dim1_m, "dim2": dim2_m},
            "verification_notebook_targets": {
                "CRC_dim1": "negative (~ -0.67 weighted)",
                "UMP_dim1": "positive (~ +0.69 weighted)",
                "LREM_RDPI_dim2": "positive high (~ +0.43 weighted)",
            },
        },
        "groupColors": GROUP_COLORS,
        "senators": senators,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    OUT_SCHEMA.write_text(
        f"""# Schéma `senators.json`

Source of truth : `{NOTEBOOK}`  
Législature **2023–2026**. Modèle `pscl::ideal` d=2 (seed=123).

## Dimensions (notebook)

| Axe | Signification |
| --- | --- |
| `idealX` = dim1 pondérée | Gauche (CRC/SOC/GEST) → droite (UC/RTLI/UMP) |
| `idealY` = dim2 pondérée | Bas → proche présidente ; haut (RDPI) → loin / outer tiers |

Orientation notebook : flip dim1 si mean(left) > mean(right) ; **pas** de flip dim2.  
Poids APRE : dim1×{dim1_m}, dim2×{dim2_m}.

## Couverture

- Sénateurs : **{len(senators)}** (modèle {n_model})
- Scrutins : **{n_rc}**
- Données : `{DATA_FOLDER}`

## Champs clés

| Champ | Signification |
| --- | --- |
| `party` / `groupe_code` | Code notebook (CRC…UMP) |
| `partyLabel` | Libellé court (RDPI pour LREM) |
| `partyColor` | Couleurs notebook |
| `idealX` / `idealY` | Coordonnées pondérées |
| `abstentionPct` | Taux d’abstention (0–100) |
| `distToGroup` | Distance au centroïde de groupe |
""",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON} ({len(senators)} senators, rollcalls={n_rc})")
    print(f"Wrote {OUT_SCHEMA}")


if __name__ == "__main__":
    main()
