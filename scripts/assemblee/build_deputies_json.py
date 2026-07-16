#!/usr/bin/env python3
"""
Export public/data/deputies.json for the 3D app — same field shape as senators.json,
with a multi-legislature timeline (L14–L17 by default).
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

import pandas as pd

# Official legislature date ranges (Assemblée nationale)
OFFICIAL_PERIODS = {
    "14": {
        "id": "l14",
        "legislature": 14,
        "label": "14e législature",
        "labelEn": "14th legislature",
        "start": "2012-06-20",
        "end": "2017-06-20",
        "startLabel": "2012",
        "endLabel": "2017",
    },
    "15": {
        "id": "l15",
        "legislature": 15,
        "label": "15e législature",
        "labelEn": "15th legislature",
        "start": "2017-06-21",
        "end": "2022-06-21",
        "startLabel": "2017",
        "endLabel": "2022",
    },
    "16": {
        "id": "l16",
        "legislature": 16,
        "label": "16e législature",
        "labelEn": "16th legislature",
        "start": "2022-06-22",
        "end": "2024-06-09",
        "startLabel": "2022",
        "endLabel": "2024",
    },
    "17": {
        "id": "l17",
        "legislature": 17,
        "label": "17e législature",
        "labelEn": "17th legislature",
        "start": "2024-07-18",
        "end": None,
        "startLabel": "2024",
        "endLabel": "…",
    },
}

FALLBACK_COLORS = {
    "LFI-NFP": "#C72C48",
    "LFI-NUPES": "#C72C48",
    "FI": "#C72C48",
    "GDR": "#A71E24",
    "GDR-NUPES": "#A71E24",
    "ECOS": "#00A85A",
    "ECOLO": "#00A85A",
    "SOC": "#F5B4CE",
    "SOC-A": "#F5B4CE",
    "SRC": "#E85A7A",
    "SER": "#E85A7A",
    "NG": "#E85A7A",
    "RRDP": "#F7A800",
    "LIOT": "#FFD96F",
    "LT": "#FFD96F",
    "NI": "#999999",
    "EPR": "#FF8C69",
    "RE": "#FF8C69",
    "LAREM": "#FF8C69",
    "DEM": "#F0A000",
    "MODEM": "#F0A000",
    "HOR": "#0BA1B0",
    "DR": "#8CB0DC",
    "LR": "#0066CC",
    "LES-REP": "#0066CC",
    "UMP": "#0066CC",
    "UDI": "#00ADDC",
    "UDI-AGIR": "#00ADDC",
    "UDI_I": "#00ADDC",
    "UDI-A-I": "#00ADDC",
    "AGIR-E": "#00ADDC",
    "LC": "#00ADDC",
    "UDDPLR": "#0A2F6B",
    "UDR": "#0A2F6B",
    "RN": "#0D378A",
    "R-UMP": "#0066CC",
}


def round_or_none(v, nd=4):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    try:
        return round(float(v), nd)
    except (TypeError, ValueError):
        return None


def pct(rate):
    if rate is None or (isinstance(rate, float) and math.isnan(rate)):
        return None
    return round(float(rate) * 100, 1)


def photo_url(acteur_id: str, legislature: str) -> str:
    m = re.search(r"(\d+)$", str(acteur_id))
    num = m.group(1) if m else str(acteur_id).replace("PA", "")
    return f"https://www.assemblee-nationale.fr/dyn/static/tribun/{legislature}/photos/{num}.jpg"


def page_url(acteur_id: str) -> str:
    return f"https://www.assemblee-nationale.fr/deputes/fiche/OMC_{acteur_id}"


def resolve_outdir(root: Path, leg: str) -> Path | None:
    nested = root / "data" / "assemblee" / "outputs" / f"l{leg}"
    flat = root / "data" / "assemblee" / "outputs"
    if (nested / "points_ideal_weighted_full.csv").exists():
        return nested
    # Legacy L17 flat layout
    if leg == "17" and (flat / "points_ideal_weighted_full.csv").exists():
        return flat
    return None


def load_period(root: Path, leg: str) -> tuple[dict, list[dict], dict] | None:
    out = resolve_outdir(root, leg)
    if out is None:
        return None
    points = pd.read_csv(out / "points_ideal_weighted_full.csv")
    # Merges in postprocess can duplicate acteur_id — keep first Ideal row
    points = points.drop_duplicates(subset=["acteur_id"], keep="first")
    summary_path = out / "model_summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}
    prepare_path = out / "prepare_summary.json"
    prepare = json.loads(prepare_path.read_text(encoding="utf-8")) if prepare_path.exists() else {}

    meta = {**OFFICIAL_PERIODS[leg]}
    meta["dateMin"] = prepare.get("date_min") or summary.get("date_min")
    meta["dateMax"] = prepare.get("date_max") or summary.get("date_max")
    meta["n_deputies"] = int(summary.get("model_deputes") or len(points))
    meta["n_rollcalls"] = int(summary.get("model_roll_calls") or 0)
    meta["dim1_multiplier"] = summary.get("dim1_multiplier")
    meta["dim2_multiplier"] = summary.get("dim2_multiplier")
    meta["fitted"] = True
    meta["sourceDir"] = str(out.relative_to(root))

    group_colors: dict[str, str] = {}
    deputies = []
    for _, row in points.iterrows():
        code = str(row.get("groupe_code") or "NI")
        color = (
            row.get("groupe_couleur")
            or row.get("groupe_couleur_dep")
            or FALLBACK_COLORS.get(code)
            or "#888888"
        )
        if isinstance(color, float) and math.isnan(color):
            color = FALLBACK_COLORS.get(code, "#888888")
        color = str(color)
        if not color.startswith("#"):
            color = FALLBACK_COLORS.get(code, "#888888")
        group_colors[code] = color

        circ_num = row.get("circonscription_numero")
        dept = row.get("departement") or row.get("departement_dep")
        circ_bits = []
        if dept and not (isinstance(dept, float) and math.isnan(dept)):
            circ_bits.append(str(dept))
        if circ_num is not None and not (isinstance(circ_num, float) and math.isnan(circ_num)):
            try:
                circ_bits.append(f"circ. {int(circ_num)}")
            except (TypeError, ValueError):
                circ_bits.append(f"circ. {circ_num}")
        circonscription = " · ".join(circ_bits) if circ_bits else None

        prenom = row.get("prenom")
        nom = row.get("nom")
        name = row.get("full_name") or " ".join(
            str(x) for x in [prenom, nom] if x and not (isinstance(x, float) and math.isnan(x))
        )
        aid = str(row["acteur_id"])
        party_label = row.get("groupe_libelle_court") or row.get("groupe_libelle") or code

        deputies.append(
            {
                "id": aid,
                "matricule": aid,
                "name": name,
                "nom": None if isinstance(nom, float) and math.isnan(nom) else nom,
                "prenom": None if isinstance(prenom, float) and math.isnan(prenom) else prenom,
                "party": code,
                "partyLabel": party_label,
                "groupe_code": code,
                "groupe_libelle": row.get("groupe_libelle") or party_label,
                "parti": party_label,
                "groupe": party_label,
                "partyColor": color,
                "idealX": round_or_none(row.get("dim1")),
                "idealY": round_or_none(row.get("dim2")),
                "idealX_raw": round_or_none(row.get("dim1_raw")),
                "idealY_raw": round_or_none(row.get("dim2_raw")),
                "abstentionPct": pct(row.get("abstention_rate")),
                "nonVotingPct": pct(row.get("non_voting_rate")),
                "yesNoShare": round_or_none(row.get("yes_no_share"), 3),
                "yesNoSharePct": pct(row.get("yes_no_share")),
                "totalPublicVotes": None
                if pd.isna(row.get("total_public_votes"))
                else int(row.get("total_public_votes")),
                "yesVotes": None if pd.isna(row.get("yes_votes")) else int(row.get("yes_votes")),
                "noVotes": None if pd.isna(row.get("no_votes")) else int(row.get("no_votes")),
                "abstentions": None
                if pd.isna(row.get("abstentions"))
                else int(row.get("abstentions")),
                "nonVoting": None if pd.isna(row.get("non_voting")) else int(row.get("non_voting")),
                "distToGroup": round_or_none(row.get("distance_to_group_center"), 3),
                "farFromGroup": bool(row.get("far_from_group")),
                "closeToGroup": bool(row.get("close_to_group")),
                "distanceToGroupLabel": None
                if pd.isna(row.get("distance_to_group_label"))
                else str(row.get("distance_to_group_label")),
                "groupLoyaltyPct": pct(row.get("group_loyalty_rate")),
                "votesAgainstGroup": None
                if pd.isna(row.get("votes_against_group"))
                else int(row.get("votes_against_group")),
                "votesWithGroup": None
                if pd.isna(row.get("votes_with_group"))
                else int(row.get("votes_with_group")),
                "yesNoVotesWithGroupMajority": None
                if pd.isna(row.get("yes_no_votes_with_group_majority"))
                else int(row.get("yes_no_votes_with_group_majority")),
                "rankInGroupLeftToRight": round_or_none(row.get("rank_left_to_right"), 1),
                "percentileInGroupLeftToRight": round_or_none(
                    row.get("percentile_left_to_right"), 3
                ),
                "rankMostLoyalInGroup": round_or_none(row.get("rank_most_loyal_in_group"), 1),
                "rankAbstentionInGroup": round_or_none(row.get("rank_abstention_in_group"), 1),
                "groupMembers": None
                if pd.isna(row.get("group_members"))
                else int(row.get("group_members")),
                "groupDim1Mean": round_or_none(row.get("group_dim1_mean")),
                "groupDim2Mean": round_or_none(row.get("group_dim2_mean")),
                "circonscription": circonscription,
                "departement": None
                if dept is None or (isinstance(dept, float) and math.isnan(dept))
                else str(dept),
                "url": page_url(aid),
                "avatar": photo_url(aid, leg),
                "siege": None
                if pd.isna(row.get("num_place"))
                else int(row.get("num_place"))
                if "num_place" in row and not pd.isna(row.get("num_place"))
                else None,
                "coordsSource": f"points_ideal_weighted AN L{leg}",
                "legislature": meta["label"],
                "legislatureId": meta["id"],
                "idealImputed": False,
                "idealRankLeftToRight": None
                if pd.isna(row.get("ideal_rank_left_to_right"))
                else int(round(float(row.get("ideal_rank_left_to_right")))),
            }
        )

    return meta, deputies, group_colors


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--legislatures",
        default="14,15,16,17",
        help="Comma-separated legislature numbers",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "public" / "data" / "deputies.json",
    )
    args = parser.parse_args()
    legs = [x.strip() for x in args.legislatures.split(",") if x.strip()]

    periods = []
    by_period: dict[str, list] = {}
    all_colors: dict[str, str] = {}
    missing = []

    for leg in legs:
        loaded = load_period(root, leg)
        if loaded is None:
            missing.append(leg)
            # Still expose official period stub so the slider can show dates
            stub = {**OFFICIAL_PERIODS[leg], "fitted": False, "n_deputies": 0, "n_rollcalls": 0}
            periods.append(stub)
            by_period[stub["id"]] = []
            continue
        meta, deputies, colors = loaded
        periods.append(meta)
        by_period[meta["id"]] = deputies
        all_colors.update(colors)

    # Prefer chronological order; default period = latest fitted
    periods.sort(key=lambda p: p["legislature"])
    fitted_ids = [p["id"] for p in periods if p.get("fitted") and by_period.get(p["id"])]
    default_period = fitted_ids[-1] if fitted_ids else periods[-1]["id"]

    payload = {
        "meta": {
            "chamber": "assemblee",
            "notebook": "notebooks/assemblee_ideal_point_model_R.ipynb",
            "model": "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25",
            "data_folder": "data/assemblee",
            "legislatures": legs,
            "missing_fits": missing,
            "defaultPeriod": default_period,
            "count": sum(len(v) for v in by_period.values()),
            "n_periods_fitted": len(fitted_ids),
        },
        "periods": periods,
        "groupColors": all_colors,
        "deputiesByPeriod": by_period,
        # Convenience alias for tools that expect .deputies = latest period
        "deputies": by_period.get(default_period, []),
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # Runtime export: a tiny manifest plus one compact file per legislature.
    # The web app can now load only the selected period instead of parsing every
    # legislature (and the duplicated latest-period alias) on startup.
    split_dir = args.out.parent / "deputies"
    split_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for period in periods:
        period_id = period["id"]
        file_name = f"{period_id}.json"
        files[period_id] = file_name
        period_payload = {
            "meta": {
                **payload["meta"],
                "count": len(by_period.get(period_id, [])),
                "period": period,
            },
            "period": period,
            "groupColors": all_colors,
            "deputies": by_period.get(period_id, []),
        }
        (split_dir / file_name).write_text(
            json.dumps(period_payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    manifest = {
        "meta": payload["meta"],
        "periods": periods,
        "groupColors": all_colors,
        "files": files,
    }
    (split_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    schema = root / "public" / "data" / "DEPUTIES_SCHEMA.md"
    schema.write_text(
        f"""# Schéma `deputies.json`

Assemblée nationale — Ideal Point multi-législatures.

## Périodes

Slider sur L14–L17 (dates officielles + plage de scrutins du modèle).

| id | Législature | Dates officielles |
| --- | --- | --- |
| l14 | 14e | 2012-06-20 → 2017-06-20 |
| l15 | 15e | 2017-06-21 → 2022-06-21 |
| l16 | 16e | 2022-06-22 → 2024-06-09 |
| l17 | 17e | 2024-07-18 → … |

Fitted in this export: {", ".join(fitted_ids) or "(none)"}.
Missing: {", ".join(missing) or "(none)"}.

## Champs député

Même forme que `senators.json` (`idealX`/`idealY`, `partyColor`, métriques,
`circonscription`, `avatar`, `url` → assemblee-nationale.fr).

## Chargement du site

Le site charge `deputies/manifest.json`, puis uniquement le fichier compact de
la législature sélectionnée (`deputies/l14.json` … `deputies/l17.json`). Le
fichier monolithique reste disponible pour les analyses et la compatibilité.
""",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "out": str(args.out),
                "periods": [
                    {
                        "id": p["id"],
                        "fitted": p.get("fitted"),
                        "n": len(by_period.get(p["id"], [])),
                    }
                    for p in periods
                ],
                "defaultPeriod": default_period,
                "bytes": args.out.stat().st_size,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
