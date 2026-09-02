#!/usr/bin/env bash
# Frees the disk space a local Android build leaves behind.
#
#   scripts/clean-build-cache.sh          # project build outputs only
#   scripts/clean-build-cache.sh --all    # also ~/.gradle caches (all Gradle projects re-download)
#   scripts/clean-build-cache.sh -n       # dry run: list what would go, delete nothing
#
# Never touches sources, node_modules packages themselves, android/local.properties,
# or ~/.gradle/wrapper (the Gradle distribution).
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
all=0
dry=0
for arg in "$@"; do
  case "$arg" in
    --all) all=1 ;;
    -n | --dry-run) dry=1 ;;
    *) echo "usage: $0 [--all] [-n|--dry-run]" >&2; exit 2 ;;
  esac
done

targets=(
  "$repo/android/app/build"
  "$repo/android/build"
  "$repo/android/.gradle"
)
# Every RN native module builds under its own android/ folder.
for dir in "$repo"/node_modules/*/android/build "$repo"/node_modules/*/android/.cxx \
           "$repo"/node_modules/@*/*/android/build "$repo"/node_modules/@*/*/android/.cxx; do
  [ -e "$dir" ] && targets+=("$dir")
done
if [ "$all" = 1 ]; then
  targets+=("$HOME/.gradle/caches" "$HOME/.gradle/daemon" "$HOME/.gradle/kotlin")
fi

existing=()
for t in "${targets[@]}"; do
  [ -e "$t" ] && existing+=("$t")
done
if [ "${#existing[@]}" = 0 ]; then
  echo "nothing to clean"
  exit 0
fi

du -sh "${existing[@]}" 2>/dev/null | sort -h
if [ "$dry" = 1 ]; then
  echo "(dry run, nothing deleted)"
  exit 0
fi

# Stop daemons first so nothing holds the files open.
if [ -x "$repo/android/gradlew" ]; then
  (cd "$repo/android" && ./gradlew --stop -q 2>/dev/null) || true
fi
rm -rf "${existing[@]}"
echo "cleaned; free: $(df -h "$repo" | awk 'NR==2{print $4}')"
