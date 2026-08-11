#!/usr/bin/env sh
# Blocks unresolved merge-conflict markers from being committed or pushed.
#
# This exists because it already happened: `src/types.ts` reached `main` with
# `<<<<<<< Updated upstream` in it, which meant HEAD did not compile.
#
# Scans the *staged diff* rather than the working tree, so it only fires on
# lines this commit actually introduces, and partial staging can't sneak a
# marker past by leaving it unstaged.
#
# Only `<<<<<<<`, `|||||||` and `>>>>>>>` are matched — deliberately NOT a bare
# `=======`, because seven equals signs are a legitimate Markdown setext
# heading underline and would fire on ordinary docs.

set -e

# --cached: the index. -U0: no context lines, so every hit is a real addition.
# diff-filter=ACM: added/copied/modified; deletions can't introduce a marker.
hits=$(git diff --cached -U0 --diff-filter=ACM | grep -nE '^\+(<{7}|\|{7}|>{7}) ' || true)

if [ -n "$hits" ]; then
  echo ""
  echo "✗ Merge conflict markers found in staged changes:"
  echo ""
  git diff --cached --name-only --diff-filter=ACM | while read -r f; do
    if git show ":$f" 2>/dev/null | grep -qE '^(<{7}|\|{7}|>{7}) '; then
      echo "    $f"
    fi
  done
  echo ""
  echo "  Resolve them, stage the result, and commit again."
  echo "  To inspect:  git diff --cached | grep -nE '^\\+(<{7}|>{7}) '"
  echo ""
  exit 1
fi
