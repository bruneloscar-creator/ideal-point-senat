#!/usr/bin/env python3
"""APRE dimension weights + final tables/plots for an AN Ideal Point fit."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))


def best_cutpoint_errors(y: np.ndarray, x: np.ndarray) -> int:
    keep = ~np.isnan(y) & ~np.isnan(x)
    y = y[keep].astype(np.int8)
    x = x[keep]
    if y.size == 0:
        return 0
    order = np.argsort(x, kind="mergesort")
    y = y[order]
    n = y.size
    ones_prefix = np.concatenate([[0], np.cumsum(y)])
    total_ones = int(ones_prefix[-1])
    best = n
    for cut in range(n + 1):
        ones_left = ones_prefix[cut]
        zeros_right = (n - cut) - (total_ones - ones_left)
        err = ones_left + zeros_right
        err_flip = n - err
        if err < best:
            best = err
        if err_flip < best:
            best = err_flip
    return int(best)


def dimension_errors(vote_matrix: np.ndarray, x: np.ndarray) -> int:
    total = 0
    for j in range(vote_matrix.shape[1]):
        total += best_cutpoint_errors(vote_matrix[:, j], x)
    return total


def build_vote_matrix(long_df: pd.DataFrame, deputy_ids: list[str]) -> np.ndarray:
    scrutins = sorted(long_df["scrutin_id"].unique())
    row_index = {a: i for i, a in enumerate(deputy_ids)}
    col_index = {s: j for j, s in enumerate(scrutins)}
    mat = np.full((len(deputy_ids), len(scrutins)), np.nan, dtype=np.float32)
    for acteur_id, scrutin_id, vote_model in long_df[
        ["acteur_id", "scrutin_id", "vote_model"]
    ].itertuples(index=False):
        i = row_index.get(str(acteur_id))
        j = col_index.get(scrutin_id)
        if i is None or j is None:
            continue
        mat[i, j] = float(vote_model)
    return mat


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument("--legislature", type=str, required=True)
    parser.add_argument("--outdir", type=Path, default=None)
    parser.add_argument("--deputes", type=Path, default=None)
    parser.add_argument("--skip-apre", action="store_true")
    args = parser.parse_args()

    leg = str(args.legislature)
    out: Path = args.outdir or (root / "data" / "assemblee" / "outputs" / f"l{leg}")
    deputes_path = args.deputes or (
        root / "data" / "assemblee" / "model_ready" / f"deputes_l{leg}.csv"
    )
    if not deputes_path.exists() and leg == "17":
        deputes_path = (
            root / "data" / "assemblee" / "model_ready" / "deputes_actifs_l17.csv"
        )

    # Ensure Senate convention (dim1 = left→right) before APRE weighting.
    # Prefer points_ideal_raw_pre_orient.csv when present (idempotent).
    from orient_ideal_points import (  # type: ignore  # noqa: E402
        DEFAULT_MAJORITY,
        load_orientation_cfg,
        orient_legislature_dir,
    )

    cfg_path = root / "scripts" / "assemblee" / "legislature_config.json"
    orient_cfg = load_orientation_cfg(cfg_path)
    entry = orient_cfg.get(str(leg)) or {}
    left = list(entry.get("left") or [])
    right = list(entry.get("right") or [])
    majority = list(entry.get("majority") or DEFAULT_MAJORITY.get(str(leg), []))
    if left and right:
        audit = orient_legislature_dir(
            out, str(leg), left, right, majority=majority, write=True
        )
        print(
            f"Orientation: swap={audit['swapped']} flip1={audit['flipped_dim1']} "
            f"flip2={audit.get('flipped_dim2')} "
            f"corr(dim1,LR) {audit['corr_dim1_LR_before']:.3f}→{audit['corr_dim1_LR_after']:.3f}"
        )

    points = pd.read_csv(out / "points_ideal_raw.csv")
    vote_profile = pd.read_csv(out / "vote_profile.csv")
    party_fidelity = pd.read_csv(out / "party_fidelity.csv")
    summary_pre = pd.read_csv(out / "model_summary_pre_weight.csv")
    deputes = pd.read_csv(deputes_path)

    points["acteur_id"] = points["acteur_id"].astype(str)
    if "groupe_code" not in points.columns:
        info = pd.read_csv(out / "deputy_info.csv")
        info["acteur_id"] = info["acteur_id"].astype(str)
        points = points.merge(info.drop_duplicates("acteur_id"), on="acteur_id", how="left")
    long_path = out / "votes_model_matrix_long.csv.gz"
    if not long_path.exists():
        long_path = out / "votes_model_matrix_long.csv"

    dim1_multiplier = 1.0
    dim2_multiplier = 1.0

    if args.skip_apre:
        print("Skipping APRE; using multipliers 1.0 / 1.0")
    else:
        print("Building vote matrix for APRE...")
        long_df = pd.read_csv(long_path)
        long_df["acteur_id"] = long_df["acteur_id"].astype(str)
        deputy_ids = points["acteur_id"].tolist()
        long_df = long_df[long_df["acteur_id"].isin(deputy_ids)]
        vote_matrix = build_vote_matrix(long_df, deputy_ids)
        print(f"Matrix {vote_matrix.shape[0]} x {vote_matrix.shape[1]}")

        majority_errors = 0
        for j in range(vote_matrix.shape[1]):
            y = vote_matrix[:, j]
            y = y[~np.isnan(y)]
            if y.size == 0:
                continue
            majority_errors += int(min((y == 1).sum(), (y == 0).sum()))

        print("Computing dimension classification errors (APRE)...")
        dim1_errors = dimension_errors(vote_matrix, points["dim1"].to_numpy())
        dim2_errors = dimension_errors(vote_matrix, points["dim2"].to_numpy())
        n_obs = int(np.isfinite(vote_matrix).sum())

        dimension_weights = pd.DataFrame(
            {
                "dimension": ["Dimension 1", "Dimension 2"],
                "classification_errors": [dim1_errors, dim2_errors],
                "correct_share": [
                    1 - dim1_errors / n_obs,
                    1 - dim2_errors / n_obs,
                ],
                "APRE": [
                    1 - dim1_errors / majority_errors if majority_errors else np.nan,
                    1 - dim2_errors / majority_errors if majority_errors else np.nan,
                ],
            }
        )
        dimension_weights["positive_APRE"] = dimension_weights["APRE"].clip(lower=0)
        max_apre = dimension_weights["positive_APRE"].max()
        dimension_weights["distance_weight"] = (
            dimension_weights["positive_APRE"] / max_apre if max_apre else 0
        )
        dimension_weights["coordinate_multiplier"] = np.sqrt(
            dimension_weights["distance_weight"]
        )
        dim1_multiplier = float(
            dimension_weights.loc[
                dimension_weights["dimension"] == "Dimension 1", "coordinate_multiplier"
            ].iloc[0]
        )
        dim2_multiplier = float(
            dimension_weights.loc[
                dimension_weights["dimension"] == "Dimension 2", "coordinate_multiplier"
            ].iloc[0]
        )
        dimension_weights.to_csv(out / "dimension_weights.csv", index=False)
        print(dimension_weights)

    points_w = points.copy()
    points_w["dim1_raw"] = points_w["dim1"]
    points_w["dim2_raw"] = points_w["dim2"]
    points_w["dim1"] = points_w["dim1"] * dim1_multiplier
    points_w["dim2"] = points_w["dim2"] * dim2_multiplier

    gstats = points_w.groupby("groupe_code", dropna=False).agg(
        group_members=("acteur_id", "size"),
        group_dim1_mean=("dim1", "mean"),
        group_dim2_mean=("dim2", "mean"),
    )
    points_w = points_w.merge(gstats, on="groupe_code", how="left")
    points_w["distance_to_group_center"] = np.sqrt(
        (points_w["dim1"] - points_w["group_dim1_mean"]) ** 2
        + (points_w["dim2"] - points_w["group_dim2_mean"]) ** 2
    )
    points_w["distance_to_group_label"] = pd.cut(
        points_w["distance_to_group_center"],
        bins=[-np.inf, 0.10, 0.25, np.inf],
        labels=["proche", "intermédiaire", "éloigné"],
    )
    points_w["close_to_group"] = points_w["distance_to_group_center"] <= 0.10
    points_w["far_from_group"] = points_w["distance_to_group_center"] >= 0.25
    points_w["rank_left_to_right"] = points_w.groupby("groupe_code")["dim1"].rank(
        method="average"
    )
    points_w["percentile_left_to_right"] = points_w.groupby("groupe_code")["dim1"].rank(
        method="average", pct=True
    )
    points_w["ideal_rank_left_to_right"] = points_w["dim1"].rank(method="average")

    def one_per_acteur(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
        keep = [c for c in cols if c in df.columns]
        out_df = df[keep].copy()
        out_df["acteur_id"] = out_df["acteur_id"].astype(str)
        return out_df.drop_duplicates("acteur_id", keep="first")

    points_final = (
        points_w.drop_duplicates("acteur_id", keep="first")
        .merge(
            one_per_acteur(
                vote_profile,
                [
                    "acteur_id",
                    "total_public_votes",
                    "yes_votes",
                    "no_votes",
                    "abstentions",
                    "non_voting",
                    "abstention_rate",
                    "non_voting_rate",
                    "yes_no_share",
                ],
            ),
            on="acteur_id",
            how="left",
        )
        .merge(
            one_per_acteur(
                party_fidelity,
                [
                    "acteur_id",
                    "yes_no_votes_with_group_majority",
                    "votes_with_group",
                    "votes_against_group",
                    "group_loyalty_rate",
                ],
            ),
            on="acteur_id",
            how="left",
        )
        .merge(
            one_per_acteur(
                deputes,
                [
                    "acteur_id",
                    "groupe_couleur",
                    "position_politique",
                    "departement",
                    "date_naissance",
                ],
            ),
            on="acteur_id",
            how="left",
            suffixes=("", "_dep"),
        )
    )
    points_final["rank_abstention_in_group"] = points_final.groupby("groupe_code")[
        "abstention_rate"
    ].rank(method="average")
    points_final["rank_most_loyal_in_group"] = points_final.groupby("groupe_code")[
        "group_loyalty_rate"
    ].rank(method="average", ascending=False)

    points_final.to_csv(out / "points_ideal_weighted_full.csv", index=False)

    summary = {
        "legislature": leg,
        "active_deputes": int(summary_pre["active_deputes"].iloc[0]),
        "model_deputes": int(summary_pre["model_deputes"].iloc[0]),
        "model_roll_calls": int(summary_pre["model_roll_calls"].iloc[0]),
        "model_rows": int(summary_pre["model_rows"].iloc[0]),
        "dim1_multiplier": dim1_multiplier,
        "dim2_multiplier": dim2_multiplier,
        "model": "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25 impute=FALSE",
    }
    pd.DataFrame([summary]).to_csv(out / "model_summary.csv", index=False)
    (out / "model_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    def as_color(val, default="#888888") -> str:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return default
        s = str(val).strip()
        if not s or s.lower() in {"nan", "none", "nat"}:
            return default
        if not s.startswith("#"):
            s = "#" + s
        if len(s) not in (4, 7, 9):
            return default
        return s

    group_colors: dict[str, str] = {}
    if "groupe_couleur" in deputes.columns and "groupe_code" in deputes.columns:
        for _, row in (
            deputes.dropna(subset=["groupe_code"]).drop_duplicates("groupe_code").iterrows()
        ):
            group_colors[str(row["groupe_code"])] = as_color(row.get("groupe_couleur"))
    for g in points_final["groupe_code"].dropna().unique():
        group_colors.setdefault(str(g), "#888888")

    fig, ax = plt.subplots(figsize=(11, 8))
    for g, sub in points_final.groupby("groupe_code"):
        ax.scatter(
            sub["dim1"],
            sub["dim2"],
            s=28,
            alpha=0.85,
            c=as_color(group_colors.get(str(g), "#888888")),
            label=str(g),
            edgecolors="none",
        )
    ax.axhline(0, color="#dddddd", lw=1)
    ax.axvline(0, color="#dddddd", lw=1)
    ax.set_xlabel("Dimension 1")
    ax.set_ylabel("Dimension 2")
    ax.set_title(f"AN {leg}e — IDEAL 2D (distances pondérées APRE)")
    ax.legend(bbox_to_anchor=(1.02, 1), loc="upper left", fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(out / "plot_ideal_2d_weighted.png", dpi=160)
    plt.close(fig)

    order = (
        points_final.groupby("groupe_code")["dim1_raw"]
        .mean()
        .sort_values()
        .index.tolist()
    )
    fig, ax = plt.subplots(figsize=(11, 8))
    rng = np.random.default_rng(123)
    for i, g in enumerate(order):
        sub = points_final[points_final["groupe_code"] == g]
        jitter = rng.uniform(-0.15, 0.15, size=len(sub))
        ax.scatter(
            sub["dim1_raw"],
            np.full(len(sub), i) + jitter,
            s=22,
            alpha=0.7,
            c=as_color(group_colors.get(str(g), "#888888")),
            edgecolors="none",
        )
        ax.scatter(
            [sub["dim1_raw"].mean()],
            [i],
            marker="D",
            s=80,
            c="black",
            zorder=3,
        )
    ax.set_yticks(range(len(order)))
    ax.set_yticklabels(order)
    ax.axvline(0, color="#cccccc")
    ax.set_xlabel("IDEAL Dimension 1")
    ax.set_title(f"AN {leg}e — positions IDEAL 1D par groupe")
    fig.tight_layout()
    fig.savefig(out / "plot_ideal_1d_by_group.png", dpi=160)
    plt.close(fig)

    g1d = (
        points_final.groupby(["groupe_code", "groupe_libelle_court"], dropna=False)
        .agg(
            deputies=("acteur_id", "size"),
            average_dim1=("dim1_raw", "mean"),
            median_dim1=("dim1_raw", "median"),
            min_dim1=("dim1_raw", "min"),
            max_dim1=("dim1_raw", "max"),
        )
        .reset_index()
        .sort_values("average_dim1")
    )
    g1d.to_csv(out / "group_1d_summary.csv", index=False)

    fig, ax = plt.subplots(figsize=(10, 6))
    y = np.arange(len(g1d))
    ax.hlines(y, g1d["min_dim1"], g1d["max_dim1"], color="#bbbbbb", lw=2)
    ax.scatter(
        g1d["average_dim1"],
        y,
        c=[as_color(group_colors.get(str(g), "#888888")) for g in g1d["groupe_code"]],
        s=60,
        zorder=3,
    )
    ax.set_yticks(y)
    ax.set_yticklabels(g1d["groupe_libelle_court"].fillna(g1d["groupe_code"]))
    ax.axvline(0, color="#cccccc")
    ax.set_xlabel("IDEAL Dimension 1")
    ax.set_title(f"AN {leg}e — moyenne IDEAL 1D par groupe")
    fig.tight_layout()
    fig.savefig(out / "plot_group_avg_1d.png", dpi=160)
    plt.close(fig)

    print("Wrote points_ideal_weighted_full.csv and plots to", out)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
