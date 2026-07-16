#!/usr/bin/env python3
"""Download official Assemblée Nationale open-data dumps (scrutins + acteurs)."""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://data.assemblee-nationale.fr/static/openData/repository"

# Ordered candidates for L13 (none currently published; kept for future).
L13_CANDIDATES = [
    f"{BASE}/13/loi/scrutins/Scrutins_XIII.json.zip",
    f"{BASE}/13/loi/scrutins/Scrutins.json.zip",
    f"{BASE}/13/loi/scrutins/ScrutinsXIII.json.zip",
]

DOWNLOADS = {
    "Scrutins_17.json.zip": f"{BASE}/17/loi/scrutins/Scrutins.json.zip",
    "Scrutins_16.json.zip": f"{BASE}/16/loi/scrutins/Scrutins.json.zip",
    "Scrutins_15.json.zip": f"{BASE}/15/loi/scrutins/Scrutins_XV.json.zip",
    "Scrutins_14.json.zip": f"{BASE}/14/loi/scrutins/Scrutins_XIV.json.zip",
    "AMO10_deputes_actifs_17.json.zip": (
        f"{BASE}/17/amo/deputes_actifs_mandats_actifs_organes/"
        "AMO10_deputes_actifs_mandats_actifs_organes.json.zip"
    ),
    "AMO10_deputes_actifs_16.json.zip": (
        f"{BASE}/16/amo/deputes_actifs_mandats_actifs_organes/"
        "AMO10_deputes_actifs_mandats_actifs_organes.json.zip"
    ),
    "AMO20_legislature_17.json.zip": (
        f"{BASE}/17/amo/deputes_senateurs_ministres_legislature/"
        "AMO20_dep_sen_min_tous_mandats_et_organes.json.zip"
    ),
    "AMO30_historique.json.zip": (
        f"{BASE}/17/amo/tous_acteurs_mandats_organes_xi_legislature/"
        "AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip"
    ),
    "liste_deputes_actifs_17.csv": (
        f"{BASE}/17/amo/deputes_actifs_csv_opendata/liste_deputes_excel.csv"
    ),
}


def download(url: str, dest: Path, force: bool = False) -> bool:
    if dest.exists() and dest.stat().st_size > 0 and not force:
        print(f"SKIP {dest.name} ({dest.stat().st_size:,} bytes)")
        return True
    print(f"GET  {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        urllib.request.urlretrieve(url, tmp)
    except urllib.error.HTTPError as exc:
        if tmp.exists():
            tmp.unlink()
        print(f"FAIL {dest.name}: HTTP {exc.code}")
        return False
    except Exception as exc:  # noqa: BLE001
        if tmp.exists():
            tmp.unlink()
        print(f"FAIL {dest.name}: {exc}")
        return False
    # Guard against HTML error pages saved as zip
    head = tmp.read_bytes()[:4]
    if dest.suffix == ".zip" and head != b"PK\x03\x04":
        tmp.unlink()
        print(f"FAIL {dest.name}: not a zip archive")
        return False
    tmp.replace(dest)
    print(f"OK   {dest.name} ({dest.stat().st_size:,} bytes)")
    return True


def try_l13(out: Path, force: bool = False) -> None:
    dest = out / "Scrutins_13.json.zip"
    if dest.exists() and dest.stat().st_size > 0 and not force:
        print(f"SKIP {dest.name} ({dest.stat().st_size:,} bytes)")
        return
    print("Attempting legislature 13 scrutin dumps (may be unpublished)...")
    for url in L13_CANDIDATES:
        if download(url, dest, force=True):
            return
    print(
        "WARN L13: no official Scrutins dump available from "
        "data.assemblee-nationale.fr (tried XIII naming variants). "
        "Pipeline continues with L14–L17."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "assemblee" / "raw",
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-l13", action="store_true")
    args = parser.parse_args()

    ok = True
    for name, url in DOWNLOADS.items():
        if not download(url, args.out / name, force=args.force):
            ok = False
    if not args.skip_l13:
        try_l13(args.out, force=args.force)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
