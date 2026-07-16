#!/usr/bin/env bash
# Prepare + fit + postprocess Ideal Point for one Assemblée législature.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LEG="${1:?usage: fit_legislature.sh <14|15|16|17>}"
OUT="$ROOT/data/assemblee/outputs/l${LEG}"
RSCRIPT="${RSCRIPT:-/opt/anaconda3/envs/r_env/bin/Rscript}"
mkdir -p "$OUT"
echo "==> Prepare L${LEG}"
python3 "$ROOT/scripts/assemblee/prepare_rollcall.py" --legislature "$LEG" --outdir "$OUT"
echo "==> Fit Ideal L${LEG}"
AN_ROOT="$ROOT" AN_LEGISLATURE="$LEG" AN_OUT_DIR="$OUT" AN_MODEL_READY="$ROOT/data/assemblee/model_ready" \
  "$RSCRIPT" "$ROOT/scripts/assemblee/run_ideal.R" 2>&1 | tee "$OUT/run_ideal.log"
echo "==> Postprocess L${LEG}"
python3 "$ROOT/scripts/assemblee/postprocess_ideal.py" --legislature "$LEG" --outdir "$OUT"
echo "==> Done L${LEG}"
