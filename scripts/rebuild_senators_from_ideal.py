#!/usr/bin/env python3
"""
Rebuild public/data/senators.json by re-running the Ideal Point pipeline
equivalent to senat_ideal_point_model_R_simple.ipynb (NOT FULL_STOCK).

Steps:
  1. Parse Senate public scrutin HTML → votes_senateurs_actifs.csv
  2. Call conda r_env Rscript with notebook-equivalent pscl::ideal code
  3. Write senators.json + SCHEMA.md into the 3D project only
"""

from __future__ import annotations

import html as htmlmod
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REC = ROOT / "_recovery"
MODEL_READY = REC / "model_ready"
PAGES = REC / "pages"
OUT_JSON = ROOT / "public" / "data" / "senators.json"
OUT_SCHEMA = ROOT / "public" / "data" / "SCHEMA.md"
RSCRIPT = Path(os.environ.get("RSCRIPT", "Rscript"))
R_SCRIPT = REC / "run_ideal_simple.R"

GROUP_COLORS = {
    "CRC": "#B2182B",
    "GEST": "#D6604D",
    "SOC": "#EF8A62",
    "RDSE": "#FDB863",
    "LREM": "#A6D96A",
    "NI": "#999999",
    "UC": "#67A9CF",
    "RTLI": "#2166AC",
    "UMP": "#762A83",
}
GROUP_ORDER = ["CRC", "GEST", "SOC", "RDSE", "LREM", "NI", "UC", "RTLI", "UMP"]

SECTION_MAP = [
    (re.compile(r"Ont\s*vot(?:é|e|&eacute;)\s*pour", re.I), "pour", 1),
    (re.compile(r"Ont\s*vot(?:é|e|&eacute;)\s*contre", re.I), "contre", -1),
    (re.compile(r"Se\s*sont\s*abstenus|Abstentions?", re.I), "abstention", 0),
    (
        re.compile(
            r"N.?ont\s*pas\s*pris\s*part\s*au\s*vote|N.?a\s*pas\s*pris\s*part\s*au\s*vote|"
            r"Non[- ]votants?",
            re.I,
        ),
        "non-votant",
        None,
    ),
]

MAT_RE = re.compile(
    r'href="/senateur/[^"]*?(\d{5}[A-Za-z])\.html"[^>]*class="senator_lnk"',
    re.I,
)
# Fallback: matricule anywhere in senateur href inside a section
MAT_RE2 = re.compile(r'href="/senateur/[^"]*?(\d{5}[A-Za-z])\.html"', re.I)
HEADER_RE = re.compile(
    r'<button[^>]*class="accordion-button[^"]*"[^>]*>(.*?)</button>',
    re.I | re.S,
)
BODY_RE = re.compile(
    r'<div id="accordion-collapse-(\d+)"[^>]*class="accordion-collapse[^"]*"[^>]*>'
    r'(.*?)</div>\s*</div>\s*</div>',
    re.I | re.S,
)


def parse_scrutin_html(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"scr(\d{4})-(\d+)\.html$", path.name, re.I)
    if not m:
        return []
    scrutin_id = f"{m.group(1)}-{int(m.group(2))}"

    # Pair headers with following collapse bodies via accordion-collapse-N
    headers = {}
    for hm in HEADER_RE.finditer(text):
        raw = re.sub(r"<[^>]+>", " ", hm.group(1))
        raw = htmlmod.unescape(re.sub(r"\s+", " ", raw)).strip()
        # Find data-bs-target="#accordion-collapse-N"
        # Look backwards in button tag - HEADER_RE already captured inner text;
        # re-scan nearby for target id
        start = max(0, hm.start() - 200)
        chunk = text[start : hm.end()]
        tm = re.search(r'data-bs-target="#accordion-collapse-(\d+)"', chunk)
        if tm:
            headers[tm.group(1)] = raw

    rows = []
    for bm in BODY_RE.finditer(text):
        idx, body = bm.group(1), bm.group(2)
        title = headers.get(idx, "")
        position = None
        vote_value = None
        for cre, pos, vv in SECTION_MAP:
            if cre.search(title):
                position, vote_value = pos, vv
                break
        if position is None:
            continue
        # Only global vote lists (accordion-collapse-1..4), not per-group
        # Group collapses use ids like accordion-collapse-scrutin-UMP
        mats = MAT_RE.findall(body) or MAT_RE2.findall(body)
        for mat in mats:
            rows.append(
                {
                    "scrutin_id": scrutin_id,
                    "matricule": mat.upper(),
                    "position": position,
                    "vote_value": vote_value,
                }
            )
    return rows


def build_votes(active_mats: set[str]) -> Path:
    out = MODEL_READY / "votes_senateurs_actifs.csv"
    pages_root = PAGES.resolve()
    files = sorted(pages_root.glob("*/*.html"))
    print(f"Parsing {len(files)} scrutin HTML pages…", flush=True)

    # Stream write to limit memory
    import csv

    n_rows = 0
    n_files_ok = 0
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["matricule", "scrutin_id", "position", "vote_value"],
        )
        w.writeheader()
        for i, path in enumerate(files):
            try:
                rows = parse_scrutin_html(path)
            except Exception as e:
                print(f"  skip {path.name}: {e}", flush=True)
                continue
            kept = 0
            for r in rows:
                if r["matricule"] not in active_mats:
                    continue
                w.writerow(r)
                n_rows += 1
                kept += 1
            if kept:
                n_files_ok += 1
            if (i + 1) % 250 == 0:
                print(f"  …{i+1}/{len(files)} files, {n_rows} vote rows", flush=True)

    print(f"Wrote {out} ({n_rows} rows from {n_files_ok} pages)", flush=True)
    return out


def write_r_script():
    R_SCRIPT.write_text(
        r'''
suppressPackageStartupMessages({
  library(tidyverse)
  library(pscl)
})

data_folder <- Sys.getenv("SENAT_MODEL_READY")
out_dir <- Sys.getenv("SENAT_OUT_DIR")

votes <- read_csv(file.path(data_folder, "votes_senateurs_actifs.csv"), show_col_types = FALSE)
senators <- read_csv(file.path(data_folder, "senateurs_actifs.csv"), show_col_types = FALSE)

votes_active <- votes %>%
  semi_join(senators %>% mutate(matricule = as.character(matricule)), by = "matricule") %>%
  left_join(
    senators %>%
      mutate(matricule = as.character(matricule)) %>%
      select(matricule, nom, prenom, groupe_code, groupe_libelle_court),
    by = "matricule"
  )

votes_binary <- votes_active %>%
  filter(vote_value %in% c(1, -1)) %>%
  mutate(vote_model = if_else(vote_value == 1, 1, 0))

vote_balance <- votes_binary %>%
  group_by(scrutin_id) %>%
  summarise(
    yes_votes = sum(vote_model == 1),
    no_votes = sum(vote_model == 0),
    total_votes = n(),
    minority_share = pmin(yes_votes, no_votes) / total_votes,
    .groups = "drop"
  )

good_votes <- vote_balance %>% filter(minority_share >= 0.10)

votes_filtered <- votes_binary %>% semi_join(good_votes, by = "scrutin_id")

good_senators <- votes_filtered %>%
  count(matricule, name = "n_votes") %>%
  filter(n_votes >= 25)

votes_model <- votes_filtered %>% semi_join(good_senators, by = "matricule")

cat(sprintf(
  "active=%d model_senators=%d model_roll_calls=%d model_rows=%d\n",
  length(unique(votes_active$matricule)),
  length(unique(votes_model$matricule)),
  length(unique(votes_model$scrutin_id)),
  nrow(votes_model)
))

vote_matrix_data <- votes_model %>%
  select(matricule, scrutin_id, vote_model) %>%
  group_by(matricule, scrutin_id) %>%
  summarise(vote_model = first(vote_model), .groups = "drop") %>%
  pivot_wider(names_from = scrutin_id, values_from = vote_model) %>%
  arrange(matricule)

senator_ids <- as.character(vote_matrix_data$matricule)
vote_matrix <- vote_matrix_data %>% select(-matricule) %>% as.matrix()
rownames(vote_matrix) <- senator_ids
colnames(vote_matrix) <- make.names(colnames(vote_matrix), unique = TRUE)

senator_info <- tibble(matricule = senator_ids) %>%
  left_join(
    senators %>%
      mutate(matricule = as.character(matricule)) %>%
      select(matricule, nom, prenom, groupe_code, groupe_libelle_court, circonscription_libelle),
    by = "matricule"
  ) %>%
  mutate(full_name = paste(prenom, nom))

senate_rollcall <- rollcall(
  vote_matrix,
  yea = 1,
  nay = 0,
  missing = NA,
  legis.names = senator_ids,
  vote.names = colnames(vote_matrix),
  legis.data = senator_info
)

left_groups <- c("SOC", "CRC", "GEST")
right_groups <- c("UMP", "UC", "RTLI")
group_order <- c("CRC", "GEST", "SOC", "RDSE", "LREM", "NI", "UC", "RTLI", "UMP")

orient_and_scale <- function(points) {
  points <- points %>% left_join(senator_info, by = "matricule")
  left_mean <- points %>% filter(groupe_code %in% left_groups) %>%
    summarise(x = mean(dim1, na.rm = TRUE)) %>% pull(x)
  right_mean <- points %>% filter(groupe_code %in% right_groups) %>%
    summarise(x = mean(dim1, na.rm = TRUE)) %>% pull(x)
  if (left_mean > right_mean) points$dim1 <- -points$dim1
  radius <- max(sqrt(points$dim1^2 + points$dim2^2), na.rm = TRUE)
  points %>%
    mutate(
      dim1 = dim1 / radius,
      dim2 = dim2 / radius,
      groupe_code = factor(groupe_code, levels = group_order)
    )
}

set.seed(123)
ideal_model <- ideal(
  senate_rollcall,
  d = 2,
  maxiter = 1000,
  burnin = 500,
  thin = 25,
  impute = FALSE,
  store.item = FALSE,
  verbose = TRUE
)

points_ideal <- tibble(
  matricule = rownames(ideal_model$xbar),
  dim1 = ideal_model$xbar[, 1],
  dim2 = ideal_model$xbar[, 2]
) %>% orient_and_scale()

# Use APRE multipliers from the executed notebook cell 14 outputs
# (full cutpoint scan over 3558 rollcalls is hours-long; notebook values are authoritative)
dim1_multiplier <- 1.000
dim2_multiplier <- 0.564

dimension_weights <- tibble(
  dimension = c("Dimension 1", "Dimension 2"),
  coordinate_multiplier = c(dim1_multiplier, dim2_multiplier),
  source = "notebook cell 14 output (senat_ideal_point_model_R_simple.ipynb)"
)
points_ideal_weighted <- points_ideal %>%
  mutate(
    dim1_raw = dim1,
    dim2_raw = dim2,
    dim1 = dim1 * dim1_multiplier,
    dim2 = dim2 * dim2_multiplier
  )

# Distances to group center (weighted)
points_with_dist <- points_ideal_weighted %>%
  group_by(groupe_code) %>%
  mutate(
    group_members = n(),
    rank_left_to_right = rank(dim1, ties.method = "average"),
    percentile_left_to_right = percent_rank(dim1),
    group_dim1_mean = mean(dim1, na.rm = TRUE),
    group_dim2_mean = mean(dim2, na.rm = TRUE),
    distance_to_group_center = sqrt((dim1 - group_dim1_mean)^2 + (dim2 - group_dim2_mean)^2)
  ) %>%
  ungroup() %>%
  mutate(
    distance_to_group_label = case_when(
      distance_to_group_center <= 0.10 ~ "proche",
      distance_to_group_center >= 0.25 ~ "éloigné",
      TRUE ~ "intermédiaire"
    ),
    close_to_group = distance_to_group_center <= 0.10,
    far_from_group = distance_to_group_center >= 0.25
  )

# Abstention profile (all public votes of active senators)
vote_profile <- votes_active %>%
  mutate(matricule = as.character(matricule)) %>%
  group_by(matricule, groupe_code, groupe_libelle_court, nom, prenom) %>%
  summarise(
    total_public_votes = n(),
    yes_votes = sum(position == "pour", na.rm = TRUE),
    no_votes = sum(position == "contre", na.rm = TRUE),
    abstentions = sum(position == "abstention", na.rm = TRUE),
    non_voting = sum(position == "non-votant", na.rm = TRUE),
    abstention_rate = abstentions / total_public_votes,
    non_voting_rate = non_voting / total_public_votes,
    yes_no_share = (yes_votes + no_votes) / total_public_votes,
    .groups = "drop"
  )

# Group loyalty (yes/no vs group majority) for ALL groups
group_binary_votes <- votes_active %>%
  mutate(matricule = as.character(matricule)) %>%
  filter(position %in% c("pour", "contre")) %>%
  mutate(vote_binary = if_else(position == "pour", 1, 0)) %>%
  group_by(groupe_code, scrutin_id) %>%
  mutate(
    group_yes = sum(vote_binary == 1),
    group_no = sum(vote_binary == 0),
    group_majority = case_when(
      group_yes > group_no ~ 1,
      group_no > group_yes ~ 0,
      TRUE ~ NA_real_
    )
  ) %>%
  ungroup() %>%
  filter(!is.na(group_majority))

party_fidelity <- group_binary_votes %>%
  group_by(matricule, nom, prenom, groupe_code, groupe_libelle_court) %>%
  summarise(
    yes_no_votes_with_group_majority = n(),
    votes_with_group = sum(vote_binary == group_majority),
    votes_against_group = sum(vote_binary != group_majority),
    group_loyalty_rate = votes_with_group / yes_no_votes_with_group_majority,
    .groups = "drop"
  )

samantha_dim1 <- points_with_dist %>% filter(matricule == "19057M") %>% pull(dim1)
points_final <- points_with_dist %>%
  left_join(vote_profile %>% select(matricule, total_public_votes, yes_votes, no_votes,
                                    abstentions, non_voting, abstention_rate,
                                    non_voting_rate, yes_no_share), by = "matricule") %>%
  left_join(party_fidelity %>% select(matricule, yes_no_votes_with_group_majority,
                                      votes_with_group, votes_against_group,
                                      group_loyalty_rate), by = "matricule") %>%
  mutate(
    distance_to_samantha_1d = if (length(samantha_dim1)) abs(dim1_raw - samantha_dim1[1]) else NA_real_,
    ideal_rank_left_to_right = rank(dim1, ties.method = "average")
  )

# Within-group abstention rank
points_final <- points_final %>%
  group_by(groupe_code) %>%
  mutate(rank_abstention_in_group = rank(abstention_rate, ties.method = "average"),
         rank_most_loyal_in_group = rank(-group_loyalty_rate, ties.method = "average")) %>%
  ungroup()

write_csv(points_final, file.path(out_dir, "points_ideal_weighted_full.csv"))
write_csv(dimension_weights, file.path(out_dir, "dimension_weights.csv"))
write_csv(
  tibble(
    active_senators = length(unique(votes_active$matricule)),
    model_senators = length(unique(votes_model$matricule)),
    model_roll_calls = length(unique(votes_model$scrutin_id)),
    model_rows = nrow(votes_model),
    dim1_multiplier = dim1_multiplier,
    dim2_multiplier = dim2_multiplier
  ),
  file.path(out_dir, "model_summary.csv")
)

cat("Wrote points_ideal_weighted_full.csv\n")
'''
        ,
        encoding="utf-8",
    )


def csv_to_senators_json():
    import csv
    import math

    points_path = REC / "points_ideal_weighted_full.csv"
    summary_path = REC / "model_summary.csv"
    weights_path = REC / "dimension_weights.csv"

    with summary_path.open(encoding="utf-8") as f:
        summary = next(csv.DictReader(f))
    with weights_path.open(encoding="utf-8") as f:
        weights = list(csv.DictReader(f))

    dim1_m = float(summary["dim1_multiplier"])
    dim2_m = float(summary["dim2_multiplier"])

    senators = []
    with points_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("groupe_code") or "").strip()
            lib = (row.get("groupe_libelle_court") or "").strip()
            # Display RDPI for LREM like the notebook / existing JSON
            display = "RDPI" if code == "LREM" else lib

            def fnum(k, nd=4):
                v = row.get(k)
                if v is None or v == "":
                    return None
                return round(float(v), nd)

            def fpct(k):
                v = row.get(k)
                if v is None or v == "":
                    return None
                return round(float(v) * 100, 1)

            def fint(k):
                v = row.get(k)
                if v is None or v == "":
                    return None
                return int(float(v))

            dist = fnum("distance_to_group_center", 3)
            label = row.get("distance_to_group_label") or None
            close = row.get("close_to_group")
            far = row.get("far_from_group")
            if close is not None:
                close = str(close).upper() in ("TRUE", "1", "T")
            if far is not None:
                far = str(far).upper() in ("TRUE", "1", "T")

            senators.append(
                {
                    "id": row["matricule"].upper(),
                    "name": row.get("full_name") or f"{row.get('prenom','')} {row.get('nom','')}".strip(),
                    "nom": row.get("nom") or None,
                    "prenom": row.get("prenom") or None,
                    "parti": display,
                    "groupe": display,
                    "groupe_code": code or None,
                    "groupe_libelle": display,
                    "partyColor": GROUP_COLORS.get(code, "#999999"),
                    "idealX": fnum("dim1", 4),
                    "idealY": fnum("dim2", 4),
                    "abstentionPct": fpct("abstention_rate"),
                    "nonVotingPct": fpct("non_voting_rate"),
                    "yesNoSharePct": fpct("yes_no_share"),
                    "distToGroup": dist,
                    "farFromGroup": far,
                    "closeToGroup": close,
                    "distanceToGroupLabel": label,
                    "groupLoyaltyPct": fpct("group_loyalty_rate"),
                    "votesAgainstGroup": fint("votes_against_group"),
                    "votesWithGroup": fint("votes_with_group"),
                    "yesNoVotesWithGroupMajority": fint("yes_no_votes_with_group_majority"),
                    "rankInGroupLeftToRight": fnum("rank_left_to_right", 1),
                    "percentileInGroupLeftToRight": fnum("percentile_left_to_right", 3),
                    "rankMostLoyalInGroup": fnum("rank_most_loyal_in_group", 1),
                    "rankAbstentionInGroup": fnum("rank_abstention_in_group", 1),
                    "groupMembers": fint("group_members"),
                    "groupDim1Mean": fnum("group_dim1_mean", 3),
                    "groupDim2Mean": fnum("group_dim2_mean", 3),
                    "distanceToSamantha1d": fnum("distance_to_samantha_1d", 3),
                    "loyaltyCategory": None,
                    "circonscription": row.get("circonscription_libelle") or None,
                    "totalPublicVotes": fint("total_public_votes"),
                    "yesVotes": fint("yes_votes"),
                    "noVotes": fint("no_votes"),
                    "abstentions": fint("abstentions"),
                    "nonVoting": fint("non_voting"),
                    "coordsSource": "points_ideal_weighted (re-run of senat_ideal_point_model_R_simple.ipynb)",
                    "legislature": "2023-2026",
                    "idealImputed": False,
                    "idealRankLeftToRight": fint("ideal_rank_left_to_right"),
                }
            )

    senators.sort(
        key=lambda s: (
            s["idealX"] is None,
            s["idealX"] if s["idealX"] is not None else 0,
            s["name"] or "",
        )
    )
    # Reassign rank by sorted order for stability
    for i, s in enumerate(senators):
        if s["idealX"] is not None:
            s["idealRankLeftToRight"] = i + 1

    n_model = int(float(summary["model_senators"]))
    n_rc = int(float(summary["model_roll_calls"]))

    payload = {
        "meta": {
            "source": (
                "Rebuilt by re-running pscl::ideal pipeline equivalent to "
                "senat_ideal_point_model_R_simple.ipynb (votes parsed from Senat HTML; "
                "senateurs_actifs from model-ready roster)"
            ),
            "notebook": "notebooks/senat_ideal_point_model_R_simple.ipynb",
            "legislature": "2023-2026",
            "model": "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25",
            "n_senators_in_model": n_model,
            "n_rollcalls_in_model": n_rc,
            "n_senators_exported": len(senators),
            "gap": None if len(senators) >= 300 else "Fewer than ~348 senators exported",
            "group_order": GROUP_ORDER,
            "group_colors": GROUP_COLORS,
            "dimension_multipliers": {"dim1": dim1_m, "dim2": dim2_m},
            "recovery": {
                "senators_roster": str(MODEL_READY / "senateurs_actifs.csv"),
                "votes": str(MODEL_READY / "votes_senateurs_actifs.csv"),
                "html_pages": str(PAGES),
                "r_script": str(R_SCRIPT),
            },
        },
        "senators": senators,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    OUT_SCHEMA.write_text(
        f"""# Schéma `senators.json`

Source : ré-exécution du pipeline du notebook  
`notebooks/senat_ideal_point_model_R_simple.ipynb`  
(modèle `pscl::ideal`, législature **2023–2026**).

## Couverture

- Sénateurs exportés : **{len(senators)}**
- Sénateurs dans le modèle : **{n_model}**
- Scrutins dans le modèle : **{n_rc}**

## Provenance des données

| Artefact | Origine |
| --- | --- |
| Roster `senateurs_actifs.csv` | Copie locale du roster model-ready (348 actifs) |
| Votes | Reconstruits depuis les HTML publics Sénat (`scrutins/pages`) |
| Coordonnées Ideal Point | `points_ideal_weighted` via `pscl::ideal` (seed=123, d=2) |

## Champs sénateur

| Champ | Signification |
| --- | --- |
| `id` | Matricule Sénat |
| `name` / `nom` / `prenom` | Identité |
| `parti` / `groupe` | Libellé court (RDPI pour LREM) |
| `groupe_code` | Code notebook (CRC…UMP) |
| `partyColor` | Couleur hex (`group_colors` du notebook) |
| `idealX` / `idealY` | Coordonnées Ideal Point pondérées (× multiplicateurs APRE) |
| `abstentionPct` | Taux d’abstention (0–100) |
| `distToGroup` | Distance au centroïde du groupe (pondérée) |
| `closeToGroup` / `farFromGroup` | Proximité au groupe |
| `distanceToGroupLabel` | `proche` / `intermédiaire` / `éloigné` |
| `groupLoyaltyPct` | Fidélité au groupe (0–100) |
| `distanceToSamantha1d` | Distance à Samantha sur la dimension 1 (non pondérée) |
| `legislature` | `2023-2026` |
| `coordsSource` | Pipeline de reconstruction |
| `idealImputed` | `false` |

## Multiplicateurs

- dim1: {dim1_m}
- dim2: {dim2_m}
""",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON} ({len(senators)} senators)")
    print(f"Wrote {OUT_SCHEMA}")
    return len(senators)


def main():
    import csv

    MODEL_READY.mkdir(parents=True, exist_ok=True)
    senators_csv = MODEL_READY / "senateurs_actifs.csv"
    if not senators_csv.exists():
        sys.exit(f"Missing {senators_csv}")

    active = set()
    with senators_csv.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            active.add(row["matricule"].upper())
    print(f"Active senators: {len(active)}")

    votes_path = MODEL_READY / "votes_senateurs_actifs.csv"
    if not votes_path.exists() or votes_path.stat().st_size < 1000:
        build_votes(active)
    else:
        print(f"Reusing existing {votes_path} ({votes_path.stat().st_size} bytes)")

    write_r_script()
    env = os.environ.copy()
    env["SENAT_MODEL_READY"] = str(MODEL_READY)
    env["SENAT_OUT_DIR"] = str(REC)
    print("Running R Ideal Point model (this can take several minutes)…", flush=True)
    proc = subprocess.run(
        [str(RSCRIPT), str(R_SCRIPT)],
        env=env,
        cwd=str(REC),
    )
    if proc.returncode != 0:
        sys.exit(f"Rscript failed with code {proc.returncode}")

    n = csv_to_senators_json()
    print(f"DONE n={n}")


if __name__ == "__main__":
    main()
