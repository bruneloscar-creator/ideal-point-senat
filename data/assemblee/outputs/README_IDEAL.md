# Ideal Point — Assemblée nationale (L14–L17)

Fitted with `pscl::ideal` d=2, seed=123, maxiter=1000, burnin=500, thin=25
(same settings as the Sénat notebook), plus APRE dimension weights.

**Orientation (Senate convention):** `dim1` / `idealX` = left → right.
If the left/right separation is stronger on dim2, axes are swapped first,
then dim1 is sign-flipped so left groups have negative mean. Do not use
`points_ideal_raw_pre_orient.csv`. See each legislature’s
`orientation_audit.json` when present.

| Legislature | Official dates | Model deputies | Roll calls | Output dir |
| --- | --- | --- | --- | --- |
| 14e | 2012-06-20 → 2017-06-20 | 621 | 638 | `outputs/l14/` |
| 15e | 2017-06-21 → 2022-06-21 | 640 | 3466 | `outputs/l15/` |
| 16e | 2022-06-22 → 2024-06-09 | 598 | 3344 | `outputs/l16/` |
| 17e | 2024-07-18 → … | 575 | 7410 | `outputs/` (legacy) + `outputs/l17/` |

## Rebuild

```bash
./scripts/assemblee/fit_legislature.sh 14   # or 15 16 17
python3 scripts/assemblee/build_deputies_json.py
npm run dev
```

Frontend consumes `public/data/deputies.json`.
