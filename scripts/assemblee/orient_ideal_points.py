#!/usr/bin/env python3
"""
Orient AN Ideal Point coordinates to the Senate convention:

  dim1 = left → right  (left groups negative, right groups positive)
  dim2 = secondary axis (optionally majority-positive)

Rule:
  1. If |mean(left)−mean(right)| is larger on dim2 than dim1 → swap.
  2. Flip dim1 so mean(left) < mean(right).
  3. Optionally flip dim2 so mean(majority) > mean(opposition).

Can re-orient existing outputs without re-running MCMC.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CFG = ROOT / "scripts" / "assemblee" / "legislature_config.json"

# Fallback majority groups when not in config (used only for optional dim2).
DEFAULT_MAJORITY: dict[str, list[str]] = {
    "14": ["SRC", "SER"],
    "15": ["LAREM", "MODEM", "DEM"],
    "16": ["RE", "DEM", "HOR"],
    "17": ["EPR", "DEM", "HOR"],
}


def load_orientation_cfg(cfg_path: Path) -> dict[str, Any]:
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    return cfg.get("orientation") or {}


def _means(df: pd.DataFrame, groups: list[str], col: str) -> tuple[float, int]:
    mask = df["groupe_code"].isin(groups)
    n = int(mask.sum())
    if n == 0 or col not in df.columns:
        return float("nan"), 0
    return float(df.loc[mask, col].mean()), n


def lr_score(df: pd.DataFrame, left: list[str], right: list[str]) -> pd.Series:
    left_set, right_set = set(left), set(right)

    def one(g: Any) -> float:
        if g in left_set:
            return -1.0
        if g in right_set:
            return 1.0
        return float("nan")

    return df["groupe_code"].map(one)


def evidence(
    df: pd.DataFrame,
    left: list[str],
    right: list[str],
    majority: list[str] | None = None,
) -> dict[str, Any]:
    left_m1, n_left = _means(df, left, "dim1")
    right_m1, n_right = _means(df, right, "dim1")
    left_m2, _ = _means(df, left, "dim2")
    right_m2, _ = _means(df, right, "dim2")
    sep1 = abs(left_m1 - right_m1) if np.isfinite(left_m1) and np.isfinite(right_m1) else float("nan")
    sep2 = abs(left_m2 - right_m2) if np.isfinite(left_m2) and np.isfinite(right_m2) else float("nan")
    score = lr_score(df, left, right)
    corr1 = float(df["dim1"].corr(score)) if score.notna().sum() > 5 else float("nan")
    corr2 = float(df["dim2"].corr(score)) if score.notna().sum() > 5 else float("nan")

    key_codes = sorted(set(left) | set(right) | set(majority or []))
    group_means: dict[str, dict[str, float]] = {}
    for g, sub in df.groupby("groupe_code"):
        if str(g) not in key_codes and len(group_means) > 30:
            continue
        group_means[str(g)] = {
            "dim1": float(sub["dim1"].mean()),
            "dim2": float(sub["dim2"].mean()),
            "n": int(len(sub)),
        }

    out: dict[str, Any] = {
        "n_left": n_left,
        "n_right": n_right,
        "left_mean_dim1": left_m1,
        "right_mean_dim1": right_m1,
        "left_mean_dim2": left_m2,
        "right_mean_dim2": right_m2,
        "sep_dim1": sep1,
        "sep_dim2": sep2,
        "corr_dim1_LR": corr1,
        "corr_dim2_LR": corr2,
        "group_means": {
            g: group_means[g]
            for g in sorted(group_means)
            if g in key_codes or group_means[g]["n"] >= 10
        },
    }
    if majority:
        maj_m1, n_maj = _means(df, majority, "dim1")
        maj_m2, _ = _means(df, majority, "dim2")
        opp = [g for g in df["groupe_code"].dropna().unique() if g not in set(majority) | {"NI"}]
        opp_m1, _ = _means(df, opp, "dim1")
        opp_m2, _ = _means(df, opp, "dim2")
        out["majority"] = majority
        out["n_majority"] = n_maj
        out["majority_mean_dim1"] = maj_m1
        out["majority_mean_dim2"] = maj_m2
        out["opposition_mean_dim1"] = opp_m1
        out["opposition_mean_dim2"] = opp_m2
        out["sep_majority_dim1"] = (
            abs(maj_m1 - opp_m1) if np.isfinite(maj_m1) and np.isfinite(opp_m1) else float("nan")
        )
        out["sep_majority_dim2"] = (
            abs(maj_m2 - opp_m2) if np.isfinite(maj_m2) and np.isfinite(opp_m2) else float("nan")
        )
    return out


def orient_dataframe(
    df: pd.DataFrame,
    left: list[str],
    right: list[str],
    *,
    majority: list[str] | None = None,
    orient_dim2_majority: bool = True,
    dim_cols: tuple[str, str] = ("dim1", "dim2"),
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Return oriented copy and audit dict (before/after + flags)."""
    out = df.copy()
    c1, c2 = dim_cols
    if "groupe_code" not in out.columns:
        raise ValueError("dataframe needs groupe_code for orientation")

    before = evidence(
        out.rename(columns={c1: "dim1", c2: "dim2"}) if (c1, c2) != ("dim1", "dim2") else out,
        left,
        right,
        majority,
    )

    swapped = False
    flipped_dim1 = False
    flipped_dim2 = False

    left_m1, n_left = _means(out, left, c1)
    right_m1, n_right = _means(out, right, c1)
    left_m2, _ = _means(out, left, c2)
    right_m2, _ = _means(out, right, c2)
    sep1 = abs(left_m1 - right_m1) if np.isfinite(left_m1) and np.isfinite(right_m1) else float("nan")
    sep2 = abs(left_m2 - right_m2) if np.isfinite(left_m2) and np.isfinite(right_m2) else float("nan")

    if n_left > 0 and n_right > 0 and np.isfinite(sep1) and np.isfinite(sep2) and sep2 > sep1:
        out[c1], out[c2] = out[c2].to_numpy(), out[c1].to_numpy()
        swapped = True
        left_m1, _ = _means(out, left, c1)
        right_m1, _ = _means(out, right, c1)

    if n_left > 0 and n_right > 0 and np.isfinite(left_m1) and np.isfinite(right_m1):
        if left_m1 > right_m1:
            out[c1] = -out[c1]
            flipped_dim1 = True

    if orient_dim2_majority and majority:
        maj_m2, n_maj = _means(out, majority, c2)
        opp = [g for g in out["groupe_code"].dropna().unique() if g not in set(majority) | {"NI"}]
        opp_m2, n_opp = _means(out, opp, c2)
        if n_maj > 0 and n_opp > 0 and np.isfinite(maj_m2) and np.isfinite(opp_m2) and maj_m2 < opp_m2:
            out[c2] = -out[c2]
            flipped_dim2 = True

    after_df = out.rename(columns={c1: "dim1", c2: "dim2"}) if (c1, c2) != ("dim1", "dim2") else out
    after = evidence(after_df, left, right, majority)

    audit = {
        "left_groups": left,
        "right_groups": right,
        "majority_groups": majority or [],
        "swapped": swapped,
        "flipped_dim1": flipped_dim1,
        "flipped_dim2": flipped_dim2,
        "sep_dim1_before": before["sep_dim1"],
        "sep_dim2_before": before["sep_dim2"],
        "corr_dim1_LR_before": before["corr_dim1_LR"],
        "corr_dim2_LR_before": before["corr_dim2_LR"],
        "corr_dim1_LR_after": after["corr_dim1_LR"],
        "corr_dim2_LR_after": after["corr_dim2_LR"],
        "before": before,
        "after": after,
    }
    return out, audit


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    # bool before int: isinstance(True, int) is True in Python.
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.floating, float)):
        x = float(obj)
        return None if not np.isfinite(x) else x
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    return obj


def resolve_raw_path(out_dir: Path) -> tuple[Path, Path | None]:
    """Prefer pre-orient MCMC coords when available."""
    pre = out_dir / "points_ideal_raw_pre_orient.csv"
    raw = out_dir / "points_ideal_raw.csv"
    if pre.exists():
        return pre, pre
    return raw, None


def orient_legislature_dir(
    out_dir: Path,
    leg: str,
    left: list[str],
    right: list[str],
    *,
    majority: list[str] | None = None,
    write: bool = True,
) -> dict[str, Any]:
    src, pre_path = resolve_raw_path(out_dir)
    if not src.exists():
        raise FileNotFoundError(src)

    points = pd.read_csv(src)
    points["acteur_id"] = points["acteur_id"].astype(str)
    if "groupe_code" not in points.columns:
        info = out_dir / "deputy_info.csv"
        if not info.exists():
            raise ValueError(f"{src} has no groupe_code and no deputy_info.csv")
        dep = pd.read_csv(info)
        dep["acteur_id"] = dep["acteur_id"].astype(str)
        points = points.merge(
            dep[["acteur_id", "groupe_code"]].drop_duplicates("acteur_id"),
            on="acteur_id",
            how="left",
        )

    # Keep a true pre-orient snapshot if we started from oriented/raw without one.
    if write and pre_path is None:
        pre_out = out_dir / "points_ideal_raw_pre_orient.csv"
        if not pre_out.exists():
            points[["acteur_id", "dim1", "dim2"]].to_csv(pre_out, index=False)

    oriented, audit = orient_dataframe(
        points, left, right, majority=majority, orient_dim2_majority=True
    )
    audit["legislature"] = leg
    audit["source_file"] = str(src.relative_to(ROOT)) if src.is_relative_to(ROOT) else str(src)

    # Unit-ball scale (matches run_ideal.R)
    radius = float(np.nanmax(np.sqrt(oriented["dim1"] ** 2 + oriented["dim2"] ** 2)))
    if radius > 0 and np.isfinite(radius):
        oriented["dim1"] = oriented["dim1"] / radius
        oriented["dim2"] = oriented["dim2"] / radius
    audit["radius"] = radius

    # Match run_ideal.R export: coords + deputy_info columns for postprocess.
    info_path = out_dir / "deputy_info.csv"
    if info_path.exists():
        dep = pd.read_csv(info_path)
        dep["acteur_id"] = dep["acteur_id"].astype(str)
        if "full_name" not in dep.columns and {"prenom", "nom"} <= set(dep.columns):
            dep["full_name"] = dep["prenom"].astype(str) + " " + dep["nom"].astype(str)
        oriented_raw = oriented[["acteur_id", "dim1", "dim2"]].merge(
            dep.drop_duplicates("acteur_id"), on="acteur_id", how="left"
        )
    else:
        oriented_raw = oriented.copy()
        cols = ["acteur_id", "dim1", "dim2"] + [
            c for c in oriented_raw.columns if c not in {"acteur_id", "dim1", "dim2"}
        ]
        oriented_raw = oriented_raw[cols]

    if write:
        oriented_raw.to_csv(out_dir / "points_ideal_raw.csv", index=False)
        (out_dir / "orientation_audit.json").write_text(
            json.dumps(_jsonable(audit), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return audit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--legislature",
        action="append",
        dest="legs",
        help="Legislature number (repeatable). Default: 14 15 16 17",
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CFG)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    legs = args.legs or ["14", "15", "16", "17"]
    orient_cfg = load_orientation_cfg(args.config)

    rows = []
    for leg in legs:
        entry = orient_cfg.get(str(leg)) or orient_cfg.get(int(leg))  # type: ignore[arg-type]
        if not entry:
            print(f"L{leg}: no orientation groups in config — skip")
            continue
        left = list(entry.get("left") or [])
        right = list(entry.get("right") or [])
        majority = list(entry.get("majority") or DEFAULT_MAJORITY.get(str(leg), []))
        out_dir = ROOT / "data" / "assemblee" / "outputs" / f"l{leg}"
        audit = orient_legislature_dir(
            out_dir,
            str(leg),
            left,
            right,
            majority=majority,
            write=not args.dry_run,
        )
        rows.append(
            {
                "leg": leg,
                "swapped": audit["swapped"],
                "flipped_dim1": audit["flipped_dim1"],
                "flipped_dim2": audit["flipped_dim2"],
                "corr1_before": audit["corr_dim1_LR_before"],
                "corr1_after": audit["corr_dim1_LR_after"],
                "sep1_before": audit["sep_dim1_before"],
                "sep2_before": audit["sep_dim2_before"],
            }
        )
        print(
            f"L{leg}: swap={audit['swapped']} flip1={audit['flipped_dim1']} "
            f"flip2={audit['flipped_dim2']} "
            f"corr(dim1,LR) {audit['corr_dim1_LR_before']:.3f} → {audit['corr_dim1_LR_after']:.3f}"
        )

    print(json.dumps(rows, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
