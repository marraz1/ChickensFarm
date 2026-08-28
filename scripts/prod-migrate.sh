#!/usr/bin/env bash
# Applies pending migrations during a Vercel *production* build.
#
# Split out of the vercel-build one-liner because it needs to retry, and because
# the reason it needs to retry takes more explaining than a shell one-liner can
# carry.
#
# `prisma migrate deploy` takes a Postgres advisory lock for the whole run. Two
# things here make that lock contended or slow to reach, and both surface the
# same way — Prisma stalls and then reports P1002, "the database server was
# reached but timed out", which says nothing about either cause:
#
#   1. More than one Vercel project is connected to this repository, so a single
#      push to the release branch starts two production builds. Both run this
#      script against the same database, and the one that loses the race waits
#      on the other's lock.
#   2. Neon suspends an idle compute. The first connection after that pays the
#      cold start, which can outlast Prisma's default connect timeout.
#
# Both are transient, so one retry turns a failed release into a slow one. It is
# safe to repeat: migrate deploy only applies migrations the database does not
# already have, and the lock means the retry waits rather than racing.
#
# The retry is a safety net, not a fix for (1) — two projects deploying the same
# repo also means two production URLs drifting apart, which no amount of
# retrying addresses.
set -euo pipefail

# migrate needs a direct connection: the runtime uses Neon's pooled URL through
# @prisma/adapter-neon, and Prisma's advisory lock does not survive PgBouncer's
# transaction pooling. DIRECT_URL is preferred when set, exactly as the README
# describes; DATABASE_URL is the documented default and is meant to be unpooled.
MIGRATE_URL="${DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "$MIGRATE_URL" ]; then
  echo "prod-migrate: neither DIRECT_URL nor DATABASE_URL is set" >&2
  exit 1
fi

case "$MIGRATE_URL" in
  *-pooler.*)
    # Named rather than silently rewritten: if the build is migrating through
    # the pooler it will hang, and the person reading this log needs to know to
    # set DIRECT_URL instead of wondering why P1002 came back.
    echo "prod-migrate: warning — migrating through what looks like Neon's" >&2
    echo "  pooled endpoint (host contains '-pooler'). prisma migrate needs the" >&2
    echo "  unpooled/direct URL; set DIRECT_URL to it in the Vercel project." >&2
    ;;
esac

run_migrate() {
  # npx, not a bare `prisma`: node_modules/.bin is only on PATH when npm runs
  # the script, and this must not depend on being invoked that way.
  DATABASE_URL="$MIGRATE_URL" npx --no-install prisma migrate deploy
}

if run_migrate; then
  exit 0
fi

echo "prod-migrate: migrate deploy failed; retrying once in 20s." >&2
sleep 20

if run_migrate; then
  echo "prod-migrate: succeeded on the retry — the first attempt hit a" >&2
  echo "  transient lock or a cold start, not a broken migration." >&2
  exit 0
fi

echo "prod-migrate: migrate deploy failed twice — see the error above." >&2
echo "  If it is P1002 (server reached, timed out), check in order: another" >&2
echo "  production build running at the same moment (a second Vercel project on" >&2
echo "  this repo), a suspended Neon compute, and whether DIRECT_URL points at" >&2
echo "  the unpooled endpoint." >&2
exit 1
