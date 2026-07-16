#!/usr/bin/env python3
"""
Align Assemblée and Sénat ideal-point spaces via bridge legislators.

Method: similarity Procrustes (translation + isotropic scale + orthogonal
rotation/reflection). Anchors are current senators who also appear in the
chosen AN législature ideal-point model.

We estimate the map that sends AN coordinates → Senate coordinates, then
apply it to all AN deputies for visualization. Diagnostics: correlation of
aligned dims, RMSE on bridges, leave-one-out RMSE.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def procrustes_similarity(
    X: np.ndarray, Y: np.ndarray
) -> tuple[np.ndarray, float, np.ndarray, dict]:
    """
    Find s, R, t minimizing ||Y - (s X R + t)||_F with R orthogonal.

    Returns transformed X, scale s, rotation R, and diagnostics.
    """
    X = np.asarray(X, dtype=float)
    Y = np.asarray(Y, dtype=float)
    assert X.shape == Y.shape and X.ndim == 2
    n, d = X.shape
    mu_x = X.mean(axis=0)
    mu_y = Y.mean(axis=0)
    Xc = X - mu_x
    Yc = Y - mu_y
    # Kabsch / orthogonal Procrustes
    A = Xc.T @ Yc
    U, S, Vt = np.linalg.svd(A)
    R = U @ Vt
    # Allow reflection (ideal spaces may flip axes)
    if np.linalg.det(R) < 0:
        U[:, -1] *= -1
        R = U @ Vt
    # Isotropic scale
    num = np.trace(np.diag(S))
    den = np.sum(Xc**2)
    s = float(num / den) if den > 0 else 1.0
    t = mu_y - s * (mu_x @ R)
    X_hat = s * (X @ R) + t
    resid = Y - X_hat
    rmse = float(np.sqrt(np.mean(resid**2)))
    # per-dimension correlations
    corrs = [
        float(np.corrcoef(X_hat[:, j], Y[:, j])[0, 1]) if n > 1 else np.nan
        for j in range(d)
    ]
    diag = {
        "n_bridges": int(n),
        "scale": s,
        "translation": t.tolist(),
        "rotation": R.tolist(),
        "rmse": rmse,
        "corr_dim1": corrs[0],
        "corr_dim2": corrs[1] if d > 1 else None,
        "singular_values": S.tolist(),
    }
    return X_hat, s, R, diag


def apply_map(X: np.ndarray, s: float, R: np.ndarray, t: np.ndarray) -> np.ndarray:
    return s * (X @ R) + t


def leave_one_out_rmse(X: np.ndarray, Y: np.ndarray) -> float:
    n = X.shape[0]
    if n < 3:
        return float("nan")
    errs = []
    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        _, s, R, diag = procrustes_similarity(X[mask], Y[mask])
        t = np.asarray(diag["translation"])
        pred = apply_map(X[i : i + 1], s, R, t)[0]
        errs.append(np.mean((pred - Y[i]) ** 2))
    return float(np.sqrt(np.mean(errs)))


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--comparison-dir",
        type=Path,
        default=root / "data" / "comparison_senat_an",
    )
    parser.add_argument(
        "--senat-points",
        type=Path,
        default=root / "data" / "senat" / "outputs" / "points_ideal_weighted_full.csv",
    )
    parser.add_argument("--legislature", type=str, default=None)
    parser.add_argument("--coords", choices=["raw", "weighted"], default="raw")
    args = parser.parse_args()
    out: Path = args.comparison_dir
    out.mkdir(parents=True, exist_ok=True)

    chosen_path = out / "chosen_legislature.json"
    if args.legislature:
        leg = str(args.legislature)
    else:
        chosen = json.loads(chosen_path.read_text(encoding="utf-8"))
        leg = str(chosen["chosen_legislature"])

    bridge_path = out / f"bridge_legislators_l{leg}.csv"
    bridges = pd.read_csv(bridge_path)
    bridges["acteur_id"] = bridges["acteur_id"].astype(str)
    bridges["matricule"] = bridges["matricule"].astype(str)

    an_points = pd.read_csv(
        root / "data" / "assemblee" / "outputs" / f"l{leg}" / "points_ideal_weighted_full.csv"
    )
    an_points["acteur_id"] = an_points["acteur_id"].astype(str)

    if not args.senat_points.exists():
        alt = root / "_recovery" / "points_ideal_weighted_full.csv"
        if alt.exists():
            args.senat_points = alt
        else:
            raise SystemExit(f"Missing Senate points: {args.senat_points}")
    sen_points = pd.read_csv(args.senat_points)
    sen_points["matricule"] = sen_points["matricule"].astype(str)

    if args.coords == "raw":
        an_x, an_y = "dim1_raw", "dim2_raw"
        sen_x, sen_y = "dim1_raw", "dim2_raw"
        if sen_x not in sen_points.columns:
            sen_x, sen_y = "dim1", "dim2"
    else:
        an_x, an_y = "dim1", "dim2"
        sen_x, sen_y = "dim1", "dim2"

    an_keep = (
        an_points[["acteur_id", an_x, an_y, "groupe_code", "nom", "prenom"]]
        .drop_duplicates("acteur_id", keep="first")
        .rename(
            columns={
                an_x: "an_dim1",
                an_y: "an_dim2",
                "groupe_code": "groupe_an",
                "nom": "nom_an",
                "prenom": "prenom_an",
            }
        )
    )
    sen_keep = (
        sen_points[["matricule", sen_x, sen_y, "groupe_code", "nom", "prenom"]]
        .drop_duplicates("matricule", keep="first")
        .rename(
            columns={
                sen_x: "sen_dim1",
                sen_y: "sen_dim2",
                "groupe_code": "groupe_senat_points",
                "nom": "nom_sen",
                "prenom": "prenom_sen",
            }
        )
    )
    merged = (
        bridges.drop_duplicates("acteur_id", keep="first")
        .merge(an_keep, on="acteur_id", how="inner")
        .merge(sen_keep, on="matricule", how="inner")
        .drop_duplicates("matricule", keep="first")
    )
    if merged.empty:
        raise SystemExit(
            "No bridge legislators present in both ideal-point outputs. "
            "Fit AN legislature first."
        )

    X = merged[["an_dim1", "an_dim2"]].to_numpy()
    Y = merged[["sen_dim1", "sen_dim2"]].to_numpy()
    X_hat, s, R, diag = procrustes_similarity(X, Y)
    diag["loo_rmse"] = leave_one_out_rmse(X, Y)
    diag["legislature"] = leg
    diag["coords"] = args.coords
    diag["method"] = (
        "Similarity Procrustes (translation + isotropic scale + orthogonal "
        "rotation/reflection) mapping AN → Senate space using bridge MPs"
    )
    t = np.asarray(diag["translation"])

    merged["an_dim1_aligned"] = X_hat[:, 0]
    merged["an_dim2_aligned"] = X_hat[:, 1]
    merged["residual_dim1"] = merged["sen_dim1"] - merged["an_dim1_aligned"]
    merged["residual_dim2"] = merged["sen_dim2"] - merged["an_dim2_aligned"]
    merged["residual_norm"] = np.sqrt(
        merged["residual_dim1"] ** 2 + merged["residual_dim2"] ** 2
    )
    merged.to_csv(out / f"bridge_mapped_l{leg}.csv", index=False)

    # Apply map to all AN deputies
    all_an = an_points.drop_duplicates("acteur_id", keep="first").copy()
    XY = all_an[[an_x, an_y]].to_numpy()
    mapped = apply_map(XY, s, R, t)
    all_an["dim1_sen_space"] = mapped[:, 0]
    all_an["dim2_sen_space"] = mapped[:, 1]
    all_an.to_csv(out / f"an_l{leg}_points_in_senate_space.csv", index=False)

    (out / f"procrustes_diagnostics_l{leg}.json").write_text(
        json.dumps(diag, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Plot: bridges before/after + clouds
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    ax = axes[0]
    ax.scatter(merged["an_dim1"], merged["an_dim2"], c="#1f77b4", label="AN (native)", s=60)
    ax.scatter(merged["sen_dim1"], merged["sen_dim2"], c="#d62728", label="Sénat", s=60)
    for _, r in merged.iterrows():
        ax.plot(
            [r["an_dim1"], r["sen_dim1"]],
            [r["an_dim2"], r["sen_dim2"]],
            color="#bbbbbb",
            lw=0.8,
            zorder=0,
        )
        ax.text(r["sen_dim1"], r["sen_dim2"], r["nom"], fontsize=7, alpha=0.8)
    ax.set_title(f"Bridges before alignment (AN L{leg} vs Sénat)")
    ax.legend(frameon=False)
    ax.axhline(0, color="#eee")
    ax.axvline(0, color="#eee")

    ax = axes[1]
    ax.scatter(
        all_an["dim1_sen_space"],
        all_an["dim2_sen_space"],
        c="#c6dbef",
        s=10,
        alpha=0.5,
        label=f"AN L{leg} (mapped)",
    )
    ax.scatter(
        sen_points[sen_x],
        sen_points[sen_y],
        c="#fcae91",
        s=10,
        alpha=0.5,
        label="Sénat",
    )
    ax.scatter(
        merged["an_dim1_aligned"],
        merged["an_dim2_aligned"],
        c="#1f77b4",
        s=70,
        label="Bridge AN→Sen",
        zorder=3,
    )
    ax.scatter(
        merged["sen_dim1"],
        merged["sen_dim2"],
        c="#d62728",
        s=70,
        marker="x",
        label="Bridge Sénat",
        zorder=4,
    )
    ax.set_title(
        f"After Procrustes (rmse={diag['rmse']:.3f}, "
        f"corr1={diag['corr_dim1']:.2f})"
    )
    ax.legend(frameon=False, fontsize=8)
    ax.axhline(0, color="#eee")
    ax.axvline(0, color="#eee")
    fig.tight_layout()
    fig.savefig(out / f"plot_alignment_l{leg}.png", dpi=160)
    plt.close(fig)

    # 1D comparison of bridges
    fig, ax = plt.subplots(figsize=(9, 6))
    order = merged.sort_values("sen_dim1")
    y = np.arange(len(order))
    ax.scatter(order["an_dim1_aligned"], y, c="#1f77b4", label="AN aligned")
    ax.scatter(order["sen_dim1"], y, c="#d62728", label="Sénat")
    for i, (_, r) in enumerate(order.iterrows()):
        ax.plot(
            [r["an_dim1_aligned"], r["sen_dim1"]],
            [i, i],
            color="#cccccc",
            lw=1,
            zorder=0,
        )
    ax.set_yticks(y)
    ax.set_yticklabels(order["nom"] + " " + order["prenom"].fillna(""))
    ax.set_xlabel("Dimension 1 (Senate space)")
    ax.set_title(f"Bridge MPs — dim1 AN(L{leg})→Sénat")
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(out / f"plot_bridge_dim1_l{leg}.png", dpi=160)
    plt.close(fig)

    # Short interpretation
    interp = []
    interp.append(
        f"Chosen AN législature for bridging: {leg} "
        f"({len(merged)} bridge legislators in both ideal models)."
    )
    interp.append(
        f"Similarity Procrustes map AN→Senate: scale={s:.3f}, "
        f"RMSE={diag['rmse']:.3f}, LOO-RMSE={diag['loo_rmse']:.3f}, "
        f"corr(dim1)={diag['corr_dim1']:.3f}, corr(dim2)={diag['corr_dim2']:.3f}."
    )
    if abs(diag["corr_dim1"]) >= 0.5:
        interp.append(
            "Dimension 1 is meaningfully shared across chambers for bridge MPs "
            "(left–right ordering is comparable after alignment)."
        )
    else:
        interp.append(
            "Dimension 1 correlation on bridges is modest; chamber-specific "
            "agendas may dominate, so cross-chamber comparisons should be cautious."
        )
    # party-side check
    if "groupe_senat" in merged.columns:
        leftish = merged["groupe_senat"].astype(str).str.contains(
            "SOC|CRCE|GEST|SER|RDSE|ECOLO|LFI|COMMUNISTE", case=False, na=False
        )
        rightish = merged["groupe_senat"].astype(str).str.contains(
            "LR|LES REP|UC|INDEP|LREM|RDPI|REPUBL", case=False, na=False
        )
        if leftish.any() and rightish.any():
            gap = merged.loc[rightish, "sen_dim1"].mean() - merged.loc[leftish, "sen_dim1"].mean()
            gap_an = (
                merged.loc[rightish, "an_dim1_aligned"].mean()
                - merged.loc[leftish, "an_dim1_aligned"].mean()
            )
            interp.append(
                f"Among bridges, mean dim1(right-like senat groups) − "
                f"dim1(left-like) = {gap:.3f} in Senate and {gap_an:.3f} after AN map."
            )
    (out / f"interpretation_l{leg}.md").write_text(
        "# Sénat ↔ Assemblée ideal-point comparison\n\n"
        + "\n\n".join(interp)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(diag, indent=2))
    print("\n".join(interp))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
