#!/usr/bin/env Rscript
# Backward-compatible wrapper → run_ideal.R for legislature 17.
args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args, value = TRUE)
script_dir <- if (length(file_arg)) {
  dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
} else {
  getwd()
}
root <- normalizePath(file.path(script_dir, "..", ".."))
Sys.setenv(
  AN_LEGISLATURE = "17",
  AN_ROOT = root,
  AN_OUT_DIR = file.path(root, "data", "assemblee", "outputs", "l17"),
  AN_MODEL_READY = file.path(root, "data", "assemblee", "model_ready")
)
system2(
  command = "Rscript",
  args = c(file.path(script_dir, "run_ideal.R"), "17"),
  wait = TRUE
)
