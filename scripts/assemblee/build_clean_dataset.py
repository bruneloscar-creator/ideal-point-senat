#!/usr/bin/env python3
"""
Parse Assemblée Nationale open-data dumps into cleaned tables mirroring the
Sénat Ideal Point pipeline schema:

  - votes_deputes_all.csv.gz          (all législatures, long format)
  - scrutins_rollcalls_all.csv        (scrutin metadata, all législatures)
  - deputes_all.csv                   (acteurs seen in votes / AMO dumps)
  - organes_groupes.csv               (political groups)
  - votes_deputes_actifs_l17.csv.gz   (latest législature, active députés)
  - deputes_actifs_l17.csv
  - scrutins_rollcalls_l17.csv
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

POSITION_MAP = {
    "pours": ("pour", 1),
    "pour": ("pour", 1),
    "contres": ("contre", -1),
    "contre": ("contre", -1),
    "abstentions": ("abstention", 0),
    "abstention": ("abstention", 0),
    "nonVotants": ("non-votant", 9),
    "nonVotant": ("non-votant", 9),
    "nonVotantsVolontaires": ("non-votant", 9),
}


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


def iter_json_from_zip(zip_path: Path) -> Iterator[tuple[str, Any]]:
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if not name.endswith(".json") or name.endswith("/"):
                continue
            with zf.open(name) as fh:
                yield name, json.load(fh)


def extract_votants(node: Any) -> list[dict]:
    if node is None:
        return []
    if isinstance(node, dict):
        if "votant" in node:
            return as_list(node["votant"])
        # sometimes a single votant object
        if "acteurRef" in node:
            return [node]
        return []
    if isinstance(node, list):
        out = []
        for item in node:
            out.extend(extract_votants(item))
        return out
    return []


def parse_scrutin(scrutin: dict) -> tuple[dict, list[dict]]:
    uid = text_uid(scrutin.get("uid"))
    legislature = str(scrutin.get("legislature") or "")
    numero = str(scrutin.get("numero") or "")
    date = scrutin.get("dateScrutin")
    titre = scrutin.get("titre") or ""
    objet = (scrutin.get("objet") or {}).get("libelle") or titre
    type_vote = scrutin.get("typeVote") or {}
    sort = scrutin.get("sort") or {}
    synthese = scrutin.get("syntheseVote") or {}
    decompte = synthese.get("decompte") or {}

    meta = {
        "scrutin_id": uid,
        "legislature": legislature,
        "numero": numero,
        "date_scrutin": date,
        "titre": titre,
        "objet": objet,
        "code_type_vote": type_vote.get("codeTypeVote"),
        "libelle_type_vote": type_vote.get("libelleTypeVote"),
        "sort_code": sort.get("code"),
        "sort_libelle": sort.get("libelle"),
        "mode_publication": scrutin.get("modePublicationDesVotes"),
        "nombre_votants": synthese.get("nombreVotants"),
        "suffrages_exprimes": synthese.get("suffragesExprimes"),
        "pour": decompte.get("pour"),
        "contre": decompte.get("contre"),
        "abstentions": decompte.get("abstentions"),
        "non_votants": decompte.get("nonVotants"),
        "demandeur": (scrutin.get("demandeur") or {}).get("texte"),
        "organe_ref": text_uid(scrutin.get("organeRef")),
        "session_ref": text_uid(scrutin.get("sessionRef")),
        "seance_ref": text_uid(scrutin.get("seanceRef")),
    }

    votes: list[dict] = []
    ventilation = ((scrutin.get("ventilationVotes") or {}).get("organe") or {})
    groupes = as_list(((ventilation.get("groupes") or {}).get("groupe")))
    for groupe in groupes:
        groupe_organe = text_uid(groupe.get("organeRef"))
        vote_block = groupe.get("vote") or {}
        position_maj = vote_block.get("positionMajoritaire")
        nominatif = vote_block.get("decompteNominatif") or {}
        for key, (position, vote_value) in POSITION_MAP.items():
            if key not in nominatif:
                continue
            for votant in extract_votants(nominatif.get(key)):
                acteur = text_uid(votant.get("acteurRef"))
                if not acteur:
                    continue
                votes.append(
                    {
                        "scrutin_id": uid,
                        "legislature": legislature,
                        "date_scrutin": date,
                        "acteur_id": acteur,
                        "mandat_ref": text_uid(votant.get("mandatRef")),
                        "groupe_organe_ref": groupe_organe,
                        "groupe_position_majoritaire": position_maj,
                        "position": position,
                        "vote_value": vote_value,
                        "par_delegation": votant.get("parDelegation"),
                        "num_place": votant.get("numPlace"),
                    }
                )
    return meta, votes


def load_scrutins_zip(zip_path: Path, legislature_hint: str) -> tuple[list[dict], list[dict]]:
    metas: list[dict] = []
    votes: list[dict] = []
    print(f"Parsing scrutins {zip_path.name} ...")
    for name, payload in iter_json_from_zip(zip_path):
        if "scrutins" in payload and isinstance(payload["scrutins"], dict):
            items = as_list(payload["scrutins"].get("scrutin"))
        elif "scrutin" in payload:
            items = as_list(payload["scrutin"])
        else:
            continue
        for scrutin in items:
            if not isinstance(scrutin, dict):
                continue
            if not scrutin.get("legislature"):
                scrutin["legislature"] = legislature_hint
            meta, vote_rows = parse_scrutin(scrutin)
            metas.append(meta)
            votes.extend(vote_rows)
    print(f"  -> {len(metas):,} scrutins, {len(votes):,} vote rows")
    return metas, votes


def parse_organe(organe: dict) -> dict:
    return {
        "organe_uid": text_uid(organe.get("uid")),
        "code_type": organe.get("codeType"),
        "libelle": organe.get("libelle"),
        "libelle_abrege": organe.get("libelleAbrege"),
        "libelle_abrev": organe.get("libelleAbrev"),
        "legislature": str(organe.get("legislature") or "") or None,
        "date_debut": organe.get("dateDebut"),
        "date_fin": organe.get("dateFin"),
        "position_politique": organe.get("positionPolitique"),
        "couleur": organe.get("couleurAssociee"),
    }


def parse_acteur(acteur: dict) -> dict:
    uid = text_uid(acteur.get("uid"))
    ident = ((acteur.get("etatCivil") or {}).get("ident") or {})
    naissance = ((acteur.get("etatCivil") or {}).get("infoNaissance") or {})
    profession = acteur.get("profession") or {}
    # current / latest GP mandat
    mandats = as_list(((acteur.get("mandats") or {}).get("mandat")))
    gp_mandats = [m for m in mandats if m.get("typeOrgane") == "GP"]
    gp_mandats_sorted = sorted(
        gp_mandats,
        key=lambda m: (m.get("dateFin") or "9999-99-99", m.get("dateDebut") or ""),
        reverse=True,
    )
    current_gp = None
    for m in gp_mandats_sorted:
        if not m.get("dateFin"):
            current_gp = m
            break
    if current_gp is None and gp_mandats_sorted:
        current_gp = gp_mandats_sorted[0]
    groupe_ref = None
    if current_gp is not None:
        organs = (current_gp.get("organes") or {}).get("organeRef")
        groupe_ref = text_uid(as_list(organs)[0] if as_list(organs) else organs)

    # ASSEMBLEE / circonscription mandat
    circ = None
    dept = None
    an_legs: list[str] = []
    senat_active = False
    for m in mandats:
        election = m.get("election") or {}
        lieu = election.get("lieu") or {}
        if lieu:
            circ = lieu.get("numCirco") or circ
            dept = lieu.get("departement") or dept
        if m.get("typeOrgane") == "ASSEMBLEE":
            if not m.get("dateFin") and lieu:
                pass
            leg = m.get("legislature")
            if leg is not None and str(leg).strip():
                for part in str(leg).replace(";", ",").split(","):
                    part = part.strip()
                    if part.isdigit() and part not in an_legs:
                        an_legs.append(part)
        if m.get("typeOrgane") == "SENAT" and not m.get("dateFin"):
            senat_active = True

    return {
        "acteur_id": uid,
        "civilite": ident.get("civ"),
        "prenom": ident.get("prenom"),
        "nom": ident.get("nom"),
        "alpha": ident.get("alpha"),
        "trigramme": ident.get("trigramme"),
        "date_naissance": naissance.get("dateNais"),
        "ville_naissance": naissance.get("villeNais"),
        "profession": profession.get("libelleCourant"),
        "groupe_organe_ref": groupe_ref,
        "circonscription_numero": circ,
        "departement": dept,
        "uri_hatvp": acteur.get("uri_hatvp"),
        "an_legislatures": "|".join(an_legs),
        "senat_active": senat_active,
    }


def load_acteurs_and_organes(zip_paths: Iterable[Path]) -> tuple[dict[str, dict], dict[str, dict]]:
    acteurs: dict[str, dict] = {}
    organes: dict[str, dict] = {}
    for zip_path in zip_paths:
        if not zip_path.exists():
            continue
        print(f"Parsing acteurs/organes {zip_path.name} ...")
        n_a = n_o = 0
        for name, payload in iter_json_from_zip(zip_path):
            if "acteur" in payload and isinstance(payload["acteur"], dict):
                row = parse_acteur(payload["acteur"])
                if row["acteur_id"]:
                    # prefer AMO10 (active) over historical if already present with more fields
                    prev = acteurs.get(row["acteur_id"])
                    if prev is None or (row.get("groupe_organe_ref") and not prev.get("groupe_organe_ref")):
                        acteurs[row["acteur_id"]] = row
                    n_a += 1
            if "organe" in payload and isinstance(payload["organe"], dict):
                row = parse_organe(payload["organe"])
                if row["organe_uid"]:
                    organes[row["organe_uid"]] = row
                    n_o += 1
            # AMO20 / bundled export shapes
            if "export" in payload and isinstance(payload["export"], dict):
                for acteur in as_list((payload["export"].get("acteurs") or {}).get("acteur")):
                    if isinstance(acteur, dict):
                        row = parse_acteur(acteur)
                        if row["acteur_id"]:
                            acteurs[row["acteur_id"]] = row
                            n_a += 1
                for organe in as_list((payload["export"].get("organes") or {}).get("organe")):
                    if isinstance(organe, dict):
                        row = parse_organe(organe)
                        if row["organe_uid"]:
                            organes[row["organe_uid"]] = row
                            n_o += 1
        print(f"  -> scanned acteurs~{n_a:,}, organes~{n_o:,}")
    return acteurs, organes


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {path} ({len(rows):,} rows)")


def write_csv_gz(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {path} ({len(rows):,} rows)")


def enrich_votes(
    votes: list[dict],
    acteurs: dict[str, dict],
    organes: dict[str, dict],
) -> list[dict]:
    out = []
    for v in votes:
        acteur = acteurs.get(v["acteur_id"], {})
        go = v.get("groupe_organe_ref")
        organe = organes.get(go or "", {})
        # fallback to acteur current group if missing in scrutin (rare)
        if not organe and acteur.get("groupe_organe_ref"):
            go = acteur["groupe_organe_ref"]
            organe = organes.get(go or "", {})
        out.append(
            {
                **v,
                "nom": acteur.get("nom"),
                "prenom": acteur.get("prenom"),
                "groupe_code": organe.get("libelle_abrev") or organe.get("libelle_abrege"),
                "groupe_libelle": organe.get("libelle"),
                "groupe_libelle_court": organe.get("libelle_abrege") or organe.get("libelle_abrev"),
            }
        )
    return out


DEPUTE_FIELDS = [
    "acteur_id",
    "nom",
    "prenom",
    "civilite",
    "trigramme",
    "date_naissance",
    "groupe_organe_ref",
    "groupe_code",
    "groupe_libelle",
    "groupe_libelle_court",
    "groupe_couleur",
    "position_politique",
    "circonscription_numero",
    "departement",
    "profession",
    "uri_hatvp",
    "an_legislatures",
    "senat_active",
]


def build_legislature_slice(
    votes: list[dict],
    acteurs: dict[str, dict],
    organes: dict[str, dict],
    legislature: str,
    active_ids: set[str] | None = None,
) -> tuple[list[dict], list[dict], list[str]]:
    votes_leg = [v for v in votes if str(v.get("legislature")) == str(legislature)]
    if active_ids:
        votes_active = [v for v in votes_leg if v["acteur_id"] in active_ids]
        ids = set(active_ids)
    else:
        ids = {v["acteur_id"] for v in votes_leg}
        votes_active = votes_leg

    # Prefer group label as observed on votes in this legislature
    groupe_from_votes: dict[str, tuple[str | None, str | None, str | None]] = {}
    for v in votes_active:
        aid = v["acteur_id"]
        if aid in groupe_from_votes:
            continue
        groupe_from_votes[aid] = (
            v.get("groupe_organe_ref"),
            v.get("groupe_code"),
            v.get("groupe_libelle_court") or v.get("groupe_libelle"),
        )

    deputes = []
    for aid in sorted(ids):
        a = acteurs.get(aid, {"acteur_id": aid})
        go_v, code_v, court_v = groupe_from_votes.get(aid, (None, None, None))
        go = go_v or a.get("groupe_organe_ref")
        organe = organes.get(go or "", {})
        deputes.append(
            {
                "acteur_id": aid,
                "nom": a.get("nom"),
                "prenom": a.get("prenom"),
                "civilite": a.get("civilite"),
                "trigramme": a.get("trigramme"),
                "date_naissance": a.get("date_naissance"),
                "groupe_organe_ref": go,
                "groupe_code": code_v
                or organe.get("libelle_abrev")
                or organe.get("libelle_abrege"),
                "groupe_libelle": organe.get("libelle"),
                "groupe_libelle_court": court_v
                or organe.get("libelle_abrege")
                or organe.get("libelle_abrev"),
                "groupe_couleur": organe.get("couleur"),
                "position_politique": organe.get("position_politique"),
                "circonscription_numero": a.get("circonscription_numero"),
                "departement": a.get("departement"),
                "profession": a.get("profession"),
                "uri_hatvp": a.get("uri_hatvp"),
                "an_legislatures": a.get("an_legislatures"),
                "senat_active": a.get("senat_active"),
            }
        )

    scrutin_ids = sorted({v["scrutin_id"] for v in votes_active})
    return votes_active, deputes, scrutin_ids


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=root / "data" / "assemblee" / "raw")
    parser.add_argument("--out", type=Path, default=root / "data" / "assemblee" / "model_ready")
    args = parser.parse_args()
    raw: Path = args.raw
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    scrutin_zips = [
        (raw / "Scrutins_13.json.zip", "13"),
        (raw / "Scrutins_14.json.zip", "14"),
        (raw / "Scrutins_15.json.zip", "15"),
        (raw / "Scrutins_16.json.zip", "16"),
        (raw / "Scrutins_17.json.zip", "17"),
    ]
    all_metas: list[dict] = []
    all_votes: list[dict] = []
    for zpath, leg in scrutin_zips:
        if not zpath.exists():
            print(f"WARN missing {zpath}")
            continue
        metas, votes = load_scrutins_zip(zpath, leg)
        all_metas.extend(metas)
        all_votes.extend(votes)

    # dedupe scrutins by uid
    meta_by_id = {m["scrutin_id"]: m for m in all_metas if m.get("scrutin_id")}
    all_metas = list(meta_by_id.values())

    acteurs, organes = load_acteurs_and_organes(
        [
            raw / "AMO10_deputes_actifs_17.json.zip",
            raw / "AMO10_deputes_actifs_16.json.zip",
            raw / "AMO20_legislature_17.json.zip",
            raw / "AMO30_historique.json.zip",
        ]
    )

    # Keep GP organes
    groupes = [o for o in organes.values() if o.get("code_type") == "GP"]
    write_csv(
        out / "organes_groupes.csv",
        sorted(groupes, key=lambda r: (r.get("legislature") or "", r.get("libelle_abrev") or "")),
        [
            "organe_uid",
            "code_type",
            "libelle",
            "libelle_abrege",
            "libelle_abrev",
            "legislature",
            "date_debut",
            "date_fin",
            "position_politique",
            "couleur",
        ],
    )

    votes_enriched = enrich_votes(all_votes, acteurs, organes)

    vote_fields = [
        "scrutin_id",
        "legislature",
        "date_scrutin",
        "acteur_id",
        "mandat_ref",
        "nom",
        "prenom",
        "groupe_organe_ref",
        "groupe_code",
        "groupe_libelle",
        "groupe_libelle_court",
        "groupe_position_majoritaire",
        "position",
        "vote_value",
        "par_delegation",
        "num_place",
    ]
    write_csv_gz(out / "votes_deputes_all.csv.gz", votes_enriched, vote_fields)

    scrutin_fields = [
        "scrutin_id",
        "legislature",
        "numero",
        "date_scrutin",
        "titre",
        "objet",
        "code_type_vote",
        "libelle_type_vote",
        "sort_code",
        "sort_libelle",
        "mode_publication",
        "nombre_votants",
        "suffrages_exprimes",
        "pour",
        "contre",
        "abstentions",
        "non_votants",
        "demandeur",
        "organe_ref",
        "session_ref",
        "seance_ref",
    ]
    write_csv(
        out / "scrutins_rollcalls_all.csv",
        sorted(all_metas, key=lambda r: (r.get("legislature") or "", r.get("date_scrutin") or "", r.get("numero") or "")),
        scrutin_fields,
    )

    # all deputies appearing in votes or AMO
    seen_ids = set(acteurs) | {v["acteur_id"] for v in votes_enriched}
    deputes_all = []
    for aid in sorted(seen_ids):
        a = acteurs.get(aid, {"acteur_id": aid})
        go = a.get("groupe_organe_ref")
        organe = organes.get(go or "", {})
        deputes_all.append(
            {
                "acteur_id": aid,
                "nom": a.get("nom"),
                "prenom": a.get("prenom"),
                "civilite": a.get("civilite"),
                "trigramme": a.get("trigramme"),
                "date_naissance": a.get("date_naissance"),
                "groupe_organe_ref": go,
                "groupe_code": organe.get("libelle_abrev") or organe.get("libelle_abrege"),
                "groupe_libelle": organe.get("libelle"),
                "groupe_libelle_court": organe.get("libelle_abrege") or organe.get("libelle_abrev"),
                "circonscription_numero": a.get("circonscription_numero"),
                "departement": a.get("departement"),
                "profession": a.get("profession"),
                "uri_hatvp": a.get("uri_hatvp"),
                "an_legislatures": a.get("an_legislatures"),
                "senat_active": a.get("senat_active"),
            }
        )
    write_csv(
        out / "deputes_all.csv",
        deputes_all,
        [
            "acteur_id",
            "nom",
            "prenom",
            "civilite",
            "trigramme",
            "date_naissance",
            "groupe_organe_ref",
            "groupe_code",
            "groupe_libelle",
            "groupe_libelle_court",
            "circonscription_numero",
            "departement",
            "profession",
            "uri_hatvp",
            "an_legislatures",
            "senat_active",
        ],
    )

    active_ids_l17: set[str] = set()
    amo10 = raw / "AMO10_deputes_actifs_17.json.zip"
    if amo10.exists():
        with zipfile.ZipFile(amo10) as zf:
            for name in zf.namelist():
                if name.startswith("json/acteur/") and name.endswith(".json"):
                    with zf.open(name) as fh:
                        active_ids_l17.add(text_uid(json.load(fh)["acteur"]["uid"]))

    # Per-legislature slices used by the multi-leg ideal pipeline
    available_legs = sorted(
        {str(m.get("legislature")) for m in all_metas if str(m.get("legislature") or "").isdigit()},
        key=int,
    )
    per_leg_stats: dict[str, dict[str, int]] = {}
    for leg in available_legs:
        active = active_ids_l17 if leg == "17" and active_ids_l17 else None
        votes_leg, deputes_leg, scrutin_ids_leg = build_legislature_slice(
            votes_enriched, acteurs, organes, leg, active
        )
        write_csv_gz(out / f"votes_deputes_l{leg}.csv.gz", votes_leg, vote_fields)
        write_csv(out / f"deputes_l{leg}.csv", deputes_leg, DEPUTE_FIELDS)
        metas_leg = [meta_by_id[sid] for sid in scrutin_ids_leg if sid in meta_by_id]
        write_csv(
            out / f"scrutins_rollcalls_l{leg}.csv",
            sorted(
                metas_leg,
                key=lambda r: (r.get("date_scrutin") or "", r.get("numero") or ""),
            ),
            scrutin_fields,
        )
        per_leg_stats[leg] = {
            "deputes": len(deputes_leg),
            "votes": len(votes_leg),
            "scrutins": len(metas_leg),
        }
        # Backward-compatible L17 aliases
        if leg == "17":
            write_csv_gz(out / "votes_deputes_actifs_l17.csv.gz", votes_leg, vote_fields)
            write_csv(out / "deputes_actifs_l17.csv", deputes_leg, DEPUTE_FIELDS)
            write_csv(
                out / "scrutins_rollcalls_l17.csv",
                sorted(
                    metas_leg,
                    key=lambda r: (r.get("date_scrutin") or "", r.get("numero") or ""),
                ),
                scrutin_fields,
            )

    # coverage summary
    by_leg: dict[str, dict[str, int]] = defaultdict(lambda: {"scrutins": 0, "votes": 0, "deputes": 0})
    for m in all_metas:
        by_leg[str(m.get("legislature"))]["scrutins"] += 1
    deputes_by_leg: dict[str, set[str]] = defaultdict(set)
    for v in votes_enriched:
        leg = str(v.get("legislature"))
        by_leg[leg]["votes"] += 1
        deputes_by_leg[leg].add(v["acteur_id"])
    for leg, ids in deputes_by_leg.items():
        by_leg[leg]["deputes"] = len(ids)

    summary_rows = [
        {
            "legislature": leg,
            "n_scrutins": stats["scrutins"],
            "n_votes": stats["votes"],
            "n_deputes_votants": stats["deputes"],
        }
        for leg, stats in sorted(by_leg.items())
    ]
    write_csv(
        out / "coverage_by_legislature.csv",
        summary_rows,
        ["legislature", "n_scrutins", "n_votes", "n_deputes_votants"],
    )

    manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "data.assemblee-nationale.fr open data dumps",
        "raw_dir": str(raw),
        "legislatures": summary_rows,
        "per_legislature_slices": per_leg_stats,
        "l17_active_deputes": per_leg_stats.get("17", {}).get("deputes"),
        "l17_votes": per_leg_stats.get("17", {}).get("votes"),
        "l17_scrutins": per_leg_stats.get("17", {}).get("scrutins"),
        "filters_for_ideal_model": {
            "keep_positions": ["pour", "contre"],
            "min_minority_share": 0.10,
            "min_votes_per_deputy": 25,
        },
        "l13_note": (
            "No official Scrutins_13 dump currently published; "
            "slice omitted unless Scrutins_13.json.zip is present in raw/."
        ),
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
