#!/usr/bin/env bash
# usage: ./deploy.sh   (needs: npm i -g vercel && vercel login, once)
set -e
cd "$(dirname "$0")"
vercel deploy --prod --yes
