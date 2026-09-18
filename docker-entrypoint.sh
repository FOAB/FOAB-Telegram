#!/bin/sh
set -eu

node dist/db/migrate.js
exec node dist/main.js
