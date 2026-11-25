#!/usr/bin/env bash
# Rebuild minified css/js from _source/ (edit files in _source/, then run this).
set -e; cd "$(dirname "$0")/.."
npx --yes esbuild@latest --version >/dev/null
for f in _source/js/*.js; do npx esbuild "$f" --minify --target=es2019 --outfile="js/$(basename $f)"; done
for f in _source/css/*.css; do npx esbuild "$f" --minify --outfile="css/$(basename $f)"; done
