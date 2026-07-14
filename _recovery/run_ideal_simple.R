
suppressPackageStartupMessages({
  library(tidyverse)
  library(pscl)
})

script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
script_path <- normalizePath(sub("^--file=", "", script_arg[[1]]))
repo_root <- normalizePath(file.path(dirname(script_path), ".."))

data_folder <- Sys.getenv(
  "SENAT_MODEL_READY",
  unset = file.path(repo_root, "data", "model_ready")
)
out_dir <- Sys.getenv(
  "SENAT_OUT_DIR",
  unset = file.path(repo_root, "_recovery")
)

votes_path <- file.path(data_folder, "votes_senateurs_actifs.csv")
if (!file.exists(votes_path)) {
  votes_path <- paste0(votes_path, ".gz")
}

votes <- read_csv(votes_path, show_col_types = FALSE)
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
