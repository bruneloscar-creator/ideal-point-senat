#!/usr/bin/env python3
"""Build a filtered roll-call matrix for one Assemblée législature (pscl::ideal)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def load_votes_for_leg(model_ready: Path, leg: str) -> pd.DataFrame:
    """Prefer per-leg slice if present; else stream-filter votes_deputes_all."""
    per_leg = model_ready / f"votes_deputes_l{leg}.csv.gz"
    if per_leg.exists():
        votes = pd.read_csv(per_leg, low_memory=False)
        votes["acteur_id"] = votes["acteur_id"].astype(str)
        return votes

    if leg == "17":
        actifs = model_ready / "votes_deputes_actifs_l17.csv.gz"
        if actifs.exists():
            votes = pd.read_csv(actifs, low_memory=False)
            votes["acteur_id"] = votes["acteur_id"].astype(str)
            return votes

    all_path = model_ready / "votes_deputes_all.csv.gz"
    if not all_path.exists():
        raise SystemExit(f"Missing votes: {all_path}")

    chunks = []
    for chunk in pd.read_csv(all_path, low_memory=False, chunksize=250_000):
        chunk["acteur_id"] = chunk["acteur_id"].astype(str)
        chunk["legislature"] = chunk["legislature"].astype(str)
        chunk = chunk[chunk["legislature"] == leg]
        if not chunk.empty:
            chunks.append(chunk)
    if not chunks:
        raise SystemExit(f"No votes for legislature {leg}")
    votes = pd.concat(chunks, ignore_index=True)
    del chunks
    print(f"Loaded {len(votes):,} vote rows for L{leg} from votes_deputes_all", flush=True)
    return votes


def first_mode(s: pd.Series):
    m = s.mode()
    return m.iloc[0] if len(m) else s.iloc[0]


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--legislature", type=str, required=True)
    parser.add_argument(
        "--model-ready",
        type=Path,
        default=root / "data" / "assemblee" / "model_ready",
    )
    parser.add_argument("--outdir", type=Path, default=None)
    parser.add_argument("--min-minority", type=float, default=0.10)
    parser.add_argument("--min-votes", type=int, default=25)
    args = parser.parse_args()

    leg = str(args.legislature)
    out: Path = args.outdir or (root / "data" / "assemblee" / "outputs" / f"l{leg}")
    out.mkdir(parents=True, exist_ok=True)

    votes = load_votes_for_leg(args.model_ready, leg)
    if "legislature" in votes.columns:
        votes = votes[votes["legislature"].astype(str) == leg].copy()

    id_cols = [
        c
        for c in [
            "nom",
            "prenom",
            "groupe_organe_ref",
            "groupe_code",
            "groupe_libelle",
            "groupe_libelle_court",
        ]
        if c in votes.columns
    ]
    mode_rows = votes.groupby("acteur_id", as_index=False).agg(
        {c: first_mode for c in id_cols}
    )

    dep_path = args.model_ready / f"deputes_l{leg}.csv"
    if not dep_path.exists() and leg == "17":
        dep_path = args.model_ready / "deputes_actifs_l17.csv"
    if not dep_path.exists():
        dep_path = args.model_ready / "deputes_all.csv"
    if dep_path.exists():
        dep = pd.read_csv(dep_path)
        dep["acteur_id"] = dep["acteur_id"].astype(str)
        extra = [
            c
            for c in [
                "civilite",
                "trigramme",
                "circonscription_numero",
                "departement",
                "profession",
                "uri_hatvp",
                "groupe_couleur",
                "position_politique",
            ]
            if c in dep.columns
        ]
        if extra:
            mode_rows = mode_rows.merge(
                dep[["acteur_id", *extra]].drop_duplicates("acteur_id"),
                on="acteur_id",
                how="left",
            )

    organes = args.model_ready / "organes_groupes.csv"
    if organes.exists():
        org = pd.read_csv(organes)
        org["legislature"] = org["legislature"].astype(str)
        org_leg = org[org["legislature"] == leg]
        if not org_leg.empty and "couleur" in org_leg.columns:
            cmap = (
                org_leg.dropna(subset=["libelle_abrev"])
                .drop_duplicates("libelle_abrev")
                .set_index("libelle_abrev")["couleur"]
                .to_dict()
            )
            if "groupe_couleur" not in mode_rows.columns:
                mode_rows["groupe_couleur"] = mode_rows["groupe_code"].map(cmap)
            else:
                mode_rows["groupe_couleur"] = mode_rows["groupe_couleur"].fillna(
                    mode_rows["groupe_code"].map(cmap)
                )

    votes_binary = votes[votes["vote_value"].isin([1, -1])].copy()
    votes_binary["vote_model"] = (votes_binary["vote_value"] == 1).astype(np.int8)

    bal = votes_binary.groupby("scrutin_id")["vote_model"].agg(yes="sum", total="count")
    bal["no"] = bal["total"] - bal["yes"]
    bal["minority_share"] = bal[["yes", "no"]].min(axis=1) / bal["total"]
    good_votes = bal[bal["minority_share"] >= args.min_minority].index
    votes_filtered = votes_binary[votes_binary["scrutin_id"].isin(good_votes)]
    n_by_dep = votes_filtered.groupby("acteur_id").size()
    good_deps = n_by_dep[n_by_dep >= args.min_votes].index
    votes_model = votes_filtered[votes_filtered["acteur_id"].isin(good_deps)]

    long = (
        votes_model.groupby(["acteur_id", "scrutin_id"], as_index=False)["vote_model"]
        .first()
        .sort_values(["acteur_id", "scrutin_id"])
    )
    mat = long.pivot(index="acteur_id", columns="scrutin_id", values="vote_model")
    mat = mat.sort_index()
    deputy_ids = mat.index.astype(str).tolist()
    scrutin_ids = mat.columns.astype(str).tolist()

    np.save(out / "vote_matrix.npy", mat.to_numpy(dtype=np.float32))
    pd.Series(deputy_ids, name="acteur_id").to_csv(out / "deputy_ids.csv", index=False)
    pd.Series(scrutin_ids, name="scrutin_id").to_csv(out / "scrutin_ids.csv", index=False)
    long.to_csv(out / "votes_model_matrix_long.csv.gz", index=False)

    info = mode_rows.set_index("acteur_id").reindex(deputy_ids).reset_index()
    info.to_csv(out / "deputy_info.csv", index=False)

    date_min = str(votes["date_scrutin"].min()) if "date_scrutin" in votes.columns else None
    date_max = str(votes["date_scrutin"].max()) if "date_scrutin" in votes.columns else None

    summary = {
        "legislature": leg,
        "active_deputes": int(votes["acteur_id"].nunique()),
        "model_deputes": len(deputy_ids),
        "model_roll_calls": len(scrutin_ids),
        "model_rows": int(len(long)),
        "matrix_shape": [len(deputy_ids), len(scrutin_ids)],
        "na_cells": int(np.isnan(mat.to_numpy()).sum()),
        "date_min": date_min,
        "date_max": date_max,
        "min_minority_share": args.min_minority,
        "min_votes_per_deputy": args.min_votes,
    }
    pd.DataFrame([summary]).to_csv(out / "model_summary_pre_weight.csv", index=False)
    (out / "prepare_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
