#!/bin/zsh
set -euo pipefail

root="${0:A:h:h}"
env_file="$root/.env.local"

if [[ ! -f "$env_file" ]]; then
  print -u2 -- "Missing $env_file"
  exit 1
fi

# Source only in a subshell, then pass just this key to Graphify.
openai_key="$(set -a; source "$env_file"; print -r -- "${OPENAI_API_KEY:-}")"
if [[ -z "$openai_key" ]]; then
  print -u2 -- "OPENAI_API_KEY is missing from $env_file"
  exit 1
fi

command -v graphify >/dev/null || { print -u2 -- "graphify is not installed"; exit 1; }
env OPENAI_API_KEY="$openai_key" graphify extract "$root" --backend openai --mode deep --out "$root" "$@"
exec env OPENAI_API_KEY="$openai_key" graphify cluster-only "$root" --backend openai
