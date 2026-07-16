#!/usr/bin/env bash
# Fit Ideal Point models for all available AN législatures (official dumps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RSCRIPT="${RSCRIPT:-/opt/anaconda3/envs/r_env/bin/Rscript}"
LEGS="${LEGS:-14 15 16 17}"

python3 scripts/assemblee/download_an_data.py
python3 scripts/assemblee/build_clean_dataset.py

for leg in $LEGS; do
  votes="data/assemblee/model_ready/votes_deputes_l${leg}.csv.gz"
  if [[ ! -f "$votes" ]]; then
    echo "SKIP l${leg}: missing $votes"
    continue
  fi
  out="data/assemblee/outputs/l${leg}"
  mkdir -p "$out"
  echo "===== Preparing legislature ${leg} ====="
  python3 scripts/assemblee/prepare_rollcall.py --legislature "$leg" --outdir "$out"
  echo "===== Fitting ideal legislature ${leg} ====="
  export AN_ROOT="$ROOT"
  export AN_LEGISLATURE="$leg"
  export AN_OUT_DIR="$ROOT/$out"
  export AN_MODEL_READY="$ROOT/data/assemblee/model_ready"
  "$RSCRIPT" scripts/assemblee/run_ideal.R "$leg" 2>&1 | tee "$out/run_ideal.log"
  echo "===== Postprocess legislature ${leg} ====="
  python3 scripts/assemblee/postprocess_ideal.py --legislature "$leg" --outdir "$out"
done

echo "All done."
