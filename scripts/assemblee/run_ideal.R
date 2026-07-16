#!/usr/bin/env Rscript
# Fit pscl::ideal on a pre-built AN roll-call matrix (prepared in Python).

suppressPackageStartupMessages({
  library(tidyverse)
  library(pscl)
  library(jsonlite)
})

read_npy <- function(path) {
  con <- file(path, "rb")
  on.exit(close(con))
  magic <- readBin(con, "raw", 6)
  if (!identical(magic, charToRaw("\x93NUMPY"))) stop("Not a npy file: ", path)
  ver <- readBin(con, "raw", 2)
  if (as.integer(ver[1]) == 1) {
    header_len <- readBin(con, "integer", 1, size = 2, endian = "little", signed = FALSE)
  } else {
    header_len <- readBin(con, "integer", 1, size = 4, endian = "little", signed = FALSE)
  }
  header <- rawToChar(readBin(con, "raw", header_len))
  descr <- sub(".*'descr': '([^']+)'.*", "\\1", header)
  fortran <- grepl("'fortran_order': True", header, fixed = TRUE)
  shape_txt <- sub(".*'shape': \\(([^)]*)\\).*", "\\1", header)
  shape_parts <- strsplit(gsub(" ", "", shape_txt), ",", fixed = TRUE)[[1]]
  shape_parts <- shape_parts[nzchar(shape_parts)]
  shape <- as.integer(shape_parts)
  n <- prod(shape)
  if (descr == "<f4") {
    data <- readBin(con, "numeric", n, size = 4, endian = "little")
  } else if (descr == "<f8") {
    data <- readBin(con, "numeric", n, size = 8, endian = "little")
  } else {
    stop("Unsupported dtype: ", descr)
  }
  if (length(shape) == 2) {
    mat <- matrix(data, nrow = shape[1], ncol = shape[2], byrow = !fortran)
  } else {
    mat <- array(data, dim = shape)
  }
  mat[is.nan(mat)] <- NA_real_
  mat
}

args <- commandArgs(trailingOnly = TRUE)
leg <- Sys.getenv("AN_LEGISLATURE", unset = "")
if (!nzchar(leg) && length(args) >= 1) leg <- args[[1]]
if (!nzchar(leg)) stop("Set AN_LEGISLATURE or pass legislature as first arg")

root <- Sys.getenv("AN_ROOT", unset = "")
if (!nzchar(root)) {
  # scripts/assemblee/run_ideal.R -> repo root
  cmd_args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", cmd_args, value = TRUE)
  if (length(file_arg)) {
    script_path <- normalizePath(sub("^--file=", "", file_arg[[1]]))
    root <- normalizePath(file.path(dirname(script_path), "..", ".."))
  } else {
    root <- normalizePath(getwd())
  }
}

out_dir <- Sys.getenv("AN_OUT_DIR", unset = "")
if (!nzchar(out_dir)) {
  out_dir <- file.path(root, "data", "assemblee", "outputs", paste0("l", leg))
}
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
cat("legislature=", leg, " out_dir=", out_dir, "\n", sep = "")

cfg_path <- file.path(root, "scripts", "assemblee", "legislature_config.json")
cfg <- fromJSON(cfg_path, simplifyVector = TRUE)
orient <- cfg$orientation[[as.character(leg)]]
if (is.null(orient)) {
  left_groups <- character(0)
  right_groups <- character(0)
} else {
  left_groups <- unlist(orient$left)
  right_groups <- unlist(orient$right)
}

vote_matrix <- read_npy(file.path(out_dir, "vote_matrix.npy"))
deputy_ids <- read_csv(file.path(out_dir, "deputy_ids.csv"), show_col_types = FALSE) %>%
  pull(acteur_id) %>% as.character()
scrutin_ids <- read_csv(file.path(out_dir, "scrutin_ids.csv"), show_col_types = FALSE) %>%
  pull(scrutin_id) %>% as.character()
deputy_info <- read_csv(file.path(out_dir, "deputy_info.csv"), show_col_types = FALSE) %>%
  mutate(
    acteur_id = as.character(acteur_id),
    full_name = paste(prenom, nom),
    groupe_code = as.character(groupe_code)
  )

stopifnot(nrow(vote_matrix) == length(deputy_ids))
stopifnot(ncol(vote_matrix) == length(scrutin_ids))
rownames(vote_matrix) <- deputy_ids
colnames(vote_matrix) <- make.names(scrutin_ids, unique = TRUE)

cat(sprintf("matrix %d x %d\n", nrow(vote_matrix), ncol(vote_matrix)))

an_rollcall <- rollcall(
  vote_matrix,
  yea = 1,
  nay = 0,
  missing = NA,
  legis.names = deputy_ids,
  vote.names = colnames(vote_matrix),
  legis.data = deputy_info
)
an_rollcall <- dropRollCall(an_rollcall, dropList = list(codes = "notInLegis"))
cat(capture.output(summary(an_rollcall)), sep = "\n")
cat("\n")

# Senate convention: dim1 = left → right. If the left/right signal is stronger
# on dim2 (common on AN), swap axes first, then flip dim1 sign if needed.
# Optional: flip dim2 so majority groups sit on the positive side.
majority_groups <- character(0)
if (!is.null(orient$majority)) {
  majority_groups <- unlist(orient$majority)
}

orient_metrics <- function(points) {
  left_pts <- points %>% filter(groupe_code %in% left_groups)
  right_pts <- points %>% filter(groupe_code %in% right_groups)
  score <- ifelse(
    points$groupe_code %in% left_groups,
    -1,
    ifelse(points$groupe_code %in% right_groups, 1, NA_real_)
  )
  list(
    n_left = nrow(left_pts),
    n_right = nrow(right_pts),
    left_mean_dim1 = mean(left_pts$dim1, na.rm = TRUE),
    right_mean_dim1 = mean(right_pts$dim1, na.rm = TRUE),
    left_mean_dim2 = mean(left_pts$dim2, na.rm = TRUE),
    right_mean_dim2 = mean(right_pts$dim2, na.rm = TRUE),
    sep_dim1 = abs(mean(left_pts$dim1, na.rm = TRUE) - mean(right_pts$dim1, na.rm = TRUE)),
    sep_dim2 = abs(mean(left_pts$dim2, na.rm = TRUE) - mean(right_pts$dim2, na.rm = TRUE)),
    corr_dim1_LR = suppressWarnings(cor(points$dim1, score, use = "pairwise.complete.obs")),
    corr_dim2_LR = suppressWarnings(cor(points$dim2, score, use = "pairwise.complete.obs"))
  )
}

orient_and_scale <- function(points) {
  points <- points %>% left_join(deputy_info, by = "acteur_id")
  n_left <- sum(points$groupe_code %in% left_groups, na.rm = TRUE)
  n_right <- sum(points$groupe_code %in% right_groups, na.rm = TRUE)
  cat("Orientation groups present: left=", n_left, " right=", n_right, "\n", sep = "")

  # Preserve MCMC coords before orientation (idempotent re-runs).
  pre_path <- file.path(out_dir, "points_ideal_raw_pre_orient.csv")
  if (!file.exists(pre_path)) {
    write_csv(points %>% select(acteur_id, dim1, dim2), pre_path)
  }

  before <- orient_metrics(points)
  swapped <- FALSE
  flipped_dim1 <- FALSE
  flipped_dim2 <- FALSE
  sep_dim1 <- before$sep_dim1
  sep_dim2 <- before$sep_dim2

  if (n_left > 0 && n_right > 0) {
    if (is.finite(sep_dim1) && is.finite(sep_dim2) && sep_dim2 > sep_dim1) {
      tmp <- points$dim1
      points$dim1 <- points$dim2
      points$dim2 <- tmp
      swapped <- TRUE
      cat(sprintf(
        "Swapped dim1/dim2 (left-right sep dim2=%.3f > dim1=%.3f)\n",
        sep_dim2, sep_dim1
      ))
    }
    left_mean <- mean(points$dim1[points$groupe_code %in% left_groups], na.rm = TRUE)
    right_mean <- mean(points$dim1[points$groupe_code %in% right_groups], na.rm = TRUE)
    if (is.finite(left_mean) && is.finite(right_mean) && left_mean > right_mean) {
      points$dim1 <- -points$dim1
      flipped_dim1 <- TRUE
      cat("Flipped dim1 so left groups are on the left\n")
    }
  }

  if (length(majority_groups) > 0) {
    maj <- points$groupe_code %in% majority_groups
    opp <- !maj & !is.na(points$groupe_code) & points$groupe_code != "NI"
    if (sum(maj, na.rm = TRUE) > 0 && sum(opp, na.rm = TRUE) > 0) {
      maj_m2 <- mean(points$dim2[maj], na.rm = TRUE)
      opp_m2 <- mean(points$dim2[opp], na.rm = TRUE)
      if (is.finite(maj_m2) && is.finite(opp_m2) && maj_m2 < opp_m2) {
        points$dim2 <- -points$dim2
        flipped_dim2 <- TRUE
        cat("Flipped dim2 so majority groups are positive\n")
      }
    }
  }

  after <- orient_metrics(points)
  radius <- max(sqrt(points$dim1^2 + points$dim2^2), na.rm = TRUE)
  audit <- list(
    left_groups = left_groups,
    right_groups = right_groups,
    majority_groups = majority_groups,
    swapped = swapped,
    flipped_dim1 = flipped_dim1,
    flipped_dim2 = flipped_dim2,
    sep_dim1_before = sep_dim1,
    sep_dim2_before = sep_dim2,
    corr_dim1_LR_before = before$corr_dim1_LR,
    corr_dim2_LR_before = before$corr_dim2_LR,
    corr_dim1_LR_after = after$corr_dim1_LR,
    corr_dim2_LR_after = after$corr_dim2_LR,
    before = before,
    after = after,
    radius = radius
  )
  writeLines(
    jsonlite::toJSON(audit, auto_unbox = TRUE, pretty = TRUE, null = "null"),
    file.path(out_dir, "orientation_audit.json")
  )

  points %>%
    mutate(
      dim1 = dim1 / radius,
      dim2 = dim2 / radius
    )
}

set.seed(123)

cat("Computing lightweight start values (SVD + zero item params)...\n")
flush.console()
vm <- an_rollcall$votes
n <- nrow(vm)
m <- ncol(vm)
d <- 2L
vm_fill <- vm
vm_fill[is.na(vm_fill)] <- 0.5
vm_c <- scale(vm_fill, center = TRUE, scale = FALSE)
svd_x <- svd(vm_c, nu = d, nv = 0)
xstart <- scale(svd_x$u[, 1:d, drop = FALSE])
bstart <- matrix(0, nrow = m, ncol = d + 1L)
rm(vm_fill, vm_c, svd_x)
gc()

cat("Fitting pscl::ideal (d=2, maxiter=1000, burnin=500, thin=25)...\n")
flush.console()
ideal_model <- ideal(
  an_rollcall,
  d = d,
  maxiter = 1000,
  burnin = 500,
  thin = 25,
  impute = FALSE,
  store.item = FALSE,
  dropList = list(codes = "notInLegis"),
  startvals = list(x = xstart, b = bstart),
  verbose = TRUE
)

points_ideal <- tibble(
  acteur_id = rownames(ideal_model$xbar),
  dim1 = ideal_model$xbar[, 1],
  dim2 = ideal_model$xbar[, 2]
) %>% orient_and_scale()

write_csv(points_ideal, file.path(out_dir, "points_ideal_raw.csv"))
saveRDS(ideal_model, file.path(out_dir, paste0("ideal_model_l", leg, ".rds")))
cat("Wrote points_ideal_raw.csv\n")

model_ready <- Sys.getenv("AN_MODEL_READY", unset = "")
if (!nzchar(model_ready)) {
  model_ready <- file.path(root, "data", "assemblee", "model_ready")
}
votes_file <- file.path(model_ready, paste0("votes_deputes_l", leg, ".csv.gz"))
if (!file.exists(votes_file) && leg == "17") {
  votes_file <- file.path(model_ready, "votes_deputes_actifs_l17.csv.gz")
}
if (!file.exists(votes_file)) {
  votes_file <- file.path(model_ready, "votes_deputes_all.csv.gz")
}

votes_ok <- FALSE
if (file.exists(votes_file)) {
  votes_ok <- tryCatch({
    votes_active <- read_csv(votes_file, show_col_types = FALSE) %>%
      mutate(acteur_id = as.character(acteur_id))
    if ("legislature" %in% names(votes_active)) {
      votes_active <- votes_active %>%
        mutate(legislature = as.character(legislature)) %>%
        filter(legislature == leg)
    }
    nrow(votes_active) > 0
  }, error = function(e) {
    cat("Could not read votes file: ", conditionMessage(e), "\n", sep = "")
    FALSE
  })
}

if (isTRUE(votes_ok)) {
  vote_profile <- votes_active %>%
    group_by(acteur_id, groupe_code, groupe_libelle_court, nom, prenom) %>%
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

  group_binary_votes <- votes_active %>%
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
    group_by(acteur_id, nom, prenom, groupe_code, groupe_libelle_court) %>%
    summarise(
      yes_no_votes_with_group_majority = n(),
      votes_with_group = sum(vote_binary == group_majority),
      votes_against_group = sum(vote_binary != group_majority),
      group_loyalty_rate = votes_with_group / yes_no_votes_with_group_majority,
      .groups = "drop"
    )
} else {
  cat("Building minimal vote profiles from model matrix (votes dump unavailable)\n")
  long <- read_csv(file.path(out_dir, "votes_model_matrix_long.csv.gz"), show_col_types = FALSE) %>%
    mutate(acteur_id = as.character(acteur_id))
  vote_profile <- long %>%
    group_by(acteur_id) %>%
    summarise(
      total_public_votes = n(),
      yes_votes = sum(vote_model == 1, na.rm = TRUE),
      no_votes = sum(vote_model == 0, na.rm = TRUE),
      abstentions = 0L,
      non_voting = 0L,
      abstention_rate = 0,
      non_voting_rate = 0,
      yes_no_share = 1,
      .groups = "drop"
    ) %>%
    left_join(
      deputy_info %>% select(acteur_id, groupe_code, groupe_libelle_court, nom, prenom),
      by = "acteur_id"
    )
  party_fidelity <- vote_profile %>%
    transmute(
      acteur_id, nom, prenom, groupe_code, groupe_libelle_court,
      yes_no_votes_with_group_majority = yes_votes + no_votes,
      votes_with_group = yes_votes + no_votes,
      votes_against_group = 0L,
      group_loyalty_rate = 1
    )
}

write_csv(vote_profile, file.path(out_dir, "vote_profile.csv"))
write_csv(party_fidelity, file.path(out_dir, "party_fidelity.csv"))
cat("Done legislature ", leg, "\n", sep = "")
