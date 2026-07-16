#!/usr/bin/env python3
"""
Identify current senators who previously sat as deputies (AMO30),
count overlap by AN législature, and emit bridge matching tables.

Matching strategy (homonym-safe):
1. Parse AMO30 acteurs with an open SENAT mandat and ≥1 ASSEMBLEE mandat.
2. Match to senateurs_actifs by normalized (prenom, nom); if ambiguous,
   disambiguate with date_naissance when available on both sides.
3. Require the person appears in that legislature's vote file with ≥25
   expressed votes (filters out one-off Congrès joint-session ballots).
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pandas as pd


def as_list(x: Any) -> list:
    if x is None:
        return []
    if isinstance(x, list):
        return x
    return [x]


def text_uid(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if "#text" in value:
            return str(value["#text"])
        if "uid" in value:
            return text_uid(value["uid"])
    return str(value)


def norm_name(s: Any) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    s = str(s).strip().lower()
    s = "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s


def parse_legs(raw: Any) -> list[str]:
    if raw is None:
        return []
    out: list[str] = []
    for part in str(raw).replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit() and part not in out:
            out.append(part)
    return out


def load_amo_bridges(amo_zip: Path) -> list[dict]:
    rows: list[dict] = []
    with zipfile.ZipFile(amo_zip) as zf:
        for name in zf.namelist():
            if not (name.startswith("json/acteur/") and name.endswith(".json")):
                continue
            with zf.open(name) as fh:
                acteur = json.load(fh)["acteur"]
            aid = text_uid(acteur.get("uid"))
            ident = ((acteur.get("etatCivil") or {}).get("ident") or {})
            naissance = ((acteur.get("etatCivil") or {}).get("infoNaissance") or {})
            mandats = as_list(((acteur.get("mandats") or {}).get("mandat")))
            sen_m = [m for m in mandats if m and m.get("typeOrgane") == "SENAT"]
            ass_m = [m for m in mandats if m and m.get("typeOrgane") == "ASSEMBLEE"]
            if not sen_m or not ass_m:
                continue
            if not any(not m.get("dateFin") for m in sen_m):
                continue
            an_legs: list[str] = []
            for m in ass_m:
                an_legs.extend(parse_legs(m.get("legislature")))
            # unique preserve order
            seen = set()
            an_legs_u = []
            for leg in an_legs:
                if leg not in seen:
                    seen.add(leg)
                    an_legs_u.append(leg)
            rows.append(
                {
                    "acteur_id": aid,
                    "prenom": ident.get("prenom"),
                    "nom": ident.get("nom"),
                    "date_naissance": naissance.get("dateNais"),
                    "ville_naissance": naissance.get("villeNais"),
                    "an_legislatures_mandat": "|".join(an_legs_u),
                    "n_assemblee_mandats": len(ass_m),
                    "senat_date_debut": max(
                        (m.get("dateDebut") or "" for m in sen_m), default=""
                    ),
                }
            )
    return rows


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--amo",
        type=Path,
        default=root / "data" / "assemblee" / "raw" / "AMO30_historique.json.zip",
    )
    parser.add_argument(
        "--senateurs",
        type=Path,
        default=root / "data" / "model_ready" / "senateurs_actifs.csv",
    )
    parser.add_argument(
        "--model-ready",
        type=Path,
        default=root / "data" / "assemblee" / "model_ready",
    )
    parser.add_argument(
        "--outdir",
        type=Path,
        default=root / "data" / "comparison_senat_an",
    )
    parser.add_argument("--min-votes", type=int, default=25)
    args = parser.parse_args()
    out: Path = args.outdir
    out.mkdir(parents=True, exist_ok=True)

    sen = pd.read_csv(args.senateurs)
    sen["prenom_n"] = sen["prenom"].map(norm_name)
    sen["nom_n"] = sen["nom"].map(norm_name)
    sen_by_key: dict[tuple[str, str], list[pd.Series]] = defaultdict(list)
    for _, r in sen.iterrows():
        sen_by_key[(r["prenom_n"], r["nom_n"])].append(r)

    amo_rows = load_amo_bridges(args.amo)
    matched: list[dict] = []
    for row in amo_rows:
        key = (norm_name(row["prenom"]), norm_name(row["nom"]))
        cands = sen_by_key.get(key, [])
        if len(cands) == 1:
            s = cands[0]
            matched.append(
                {
                    **row,
                    "matricule": s["matricule"],
                    "groupe_senat": s["groupe_code"],
                    "groupe_senat_court": s["groupe_libelle_court"],
                    "circonscription_senat": s["circonscription_libelle"],
                    "match_method": "name_unique",
                    "match_ok": True,
                }
            )
        elif len(cands) > 1:
            # Prefer DOB if senat side ever gains it; otherwise flag ambiguous
            matched.append(
                {
                    **row,
                    "matricule": None,
                    "match_method": "name_ambiguous",
                    "match_ok": False,
                    "n_name_candidates": len(cands),
                }
            )
        else:
            matched.append(
                {
                    **row,
                    "matricule": None,
                    "match_method": "unmatched_to_senateurs_actifs",
                    "match_ok": False,
                }
            )

    bridges = pd.DataFrame(matched)
    bridges.to_csv(out / "bridge_candidates_amo.csv", index=False)

    # Vote counts by legislature for each acteur
    vote_counts: dict[str, dict[str, int]] = defaultdict(dict)
    available_legs = []
    for path in sorted(args.model_ready.glob("votes_deputes_l*.csv.gz")):
        m = re.search(r"votes_deputes_l(\d+)\.csv\.gz$", path.name)
        if not m:
            continue
        leg = m.group(1)
        available_legs.append(leg)
        v = pd.read_csv(path, usecols=["acteur_id", "vote_value"], low_memory=False)
        v["acteur_id"] = v["acteur_id"].astype(str)
        binary = v[v["vote_value"].isin([1, -1])]
        vc = binary.groupby("acteur_id").size()
        for aid, n in vc.items():
            vote_counts[str(aid)][leg] = int(n)

    ok = bridges[bridges["match_ok"] == True].copy()  # noqa: E712
    overlap_rows = []
    for _, r in ok.iterrows():
        aid = str(r["acteur_id"])
        legs_mandat = parse_legs(str(r["an_legislatures_mandat"]).replace("|", ","))
        for leg in sorted(set(legs_mandat) | set(vote_counts.get(aid, {})), key=lambda x: int(x) if x.isdigit() else 999):
            n_votes = vote_counts.get(aid, {}).get(leg, 0)
            in_mandat = leg in legs_mandat
            overlap_rows.append(
                {
                    "matricule": r["matricule"],
                    "acteur_id": aid,
                    "prenom": r["prenom"],
                    "nom": r["nom"],
                    "date_naissance": r["date_naissance"],
                    "groupe_senat": r.get("groupe_senat"),
                    "legislature": leg,
                    "has_assemblee_mandat": in_mandat,
                    "n_yes_no_votes": n_votes,
                    "eligible_bridge": bool(in_mandat and n_votes >= args.min_votes),
                }
            )
    overlap = pd.DataFrame(overlap_rows)
    overlap.to_csv(out / "bridge_overlap_by_legislature.csv", index=False)

    summary_legs = []
    for leg in sorted({str(x) for x in overlap["legislature"]}, key=lambda x: int(x)):
        sub = overlap[overlap["legislature"] == leg]
        summary_legs.append(
            {
                "legislature": leg,
                "n_with_mandat": int(sub["has_assemblee_mandat"].sum()),
                "n_with_votes": int((sub["n_yes_no_votes"] > 0).sum()),
                "n_eligible_bridge_min_votes": int(sub["eligible_bridge"].sum()),
                "data_available": leg in available_legs,
            }
        )
    summary_df = pd.DataFrame(summary_legs).sort_values(
        ["n_eligible_bridge_min_votes", "n_with_mandat"], ascending=False
    )
    summary_df.to_csv(out / "overlap_summary_by_legislature.csv", index=False)

    chosen = None
    for _, row in summary_df.iterrows():
        if row["data_available"] and row["n_eligible_bridge_min_votes"] > 0:
            chosen = str(row["legislature"])
            break

    rationale = {
        "chosen_legislature": chosen,
        "criterion": (
            "Maximize number of *current* senators who (a) held an ASSEMBLEE "
            "mandat in that législature per AMO30 and (b) cast ≥ "
            f"{args.min_votes} yes/no votes in the cleaned AN vote file "
            "(excludes Congrès one-offs)."
        ),
        "n_current_senators": int(len(sen)),
        "n_amo_active_senators_with_an_mandat": int(len(amo_rows)),
        "n_matched_to_senateurs_actifs": int(ok.shape[0]),
        "match_method_counts": bridges["match_method"].value_counts().to_dict(),
        "overlap_by_legislature": summary_legs,
        "l13_note": (
            "L13 often appears in mandats but has no official Scrutins dump; "
            "it cannot be used for ideal-point bridging until votes exist."
        ),
    }
    (out / "chosen_legislature.json").write_text(
        json.dumps(rationale, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if chosen:
        eligible = overlap[
            (overlap["legislature"] == chosen) & (overlap["eligible_bridge"])
        ].copy()
        eligible.to_csv(out / f"bridge_legislators_l{chosen}.csv", index=False)
        print(f"Chosen AN legislature: {chosen} (n_bridge={len(eligible)})")
    else:
        print("No eligible bridge legislature with vote data.")

    print(json.dumps(rationale, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
