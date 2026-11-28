#!/bin/sh
# Container entrypoint for DirectFanz on ECS.
#
# RDS manages the database password in Secrets Manager. ECS injects its
# username and password as DB_USERNAME / DB_PASSWORD, and Terraform sets
# DB_HOST / DB_PORT / DB_NAME. Prisma wants one DATABASE_URL, so build it here
# (with the password URL-encoded and TLS required) unless one was given.
# Nothing here prints a secret.
set -eu

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  DATABASE_URL="$(node -e '
    const e = process.env;
    const user = encodeURIComponent(e.DB_USERNAME || "directfanz");
    const pass = encodeURIComponent(e.DB_PASSWORD);
    const port = e.DB_PORT || "5432";
    const name = e.DB_NAME || "directfanz";
    const limit = e.DB_CONNECTION_LIMIT || "10";
    process.stdout.write(`postgresql://${user}:${pass}@${e.DB_HOST}:${port}/${name}?sslmode=require&connection_limit=${limit}`);
  ')"
  export DATABASE_URL
fi
unset DB_PASSWORD

exec "$@"
