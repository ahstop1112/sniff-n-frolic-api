#!/bin/sh
echo "DATABASE_URL is: $DATABASE_URL"
echo "Running migrations..."

for f in $(ls db/migrations/*.sql | sort); do
  echo "→ $f"
  psql "$DATABASE_URL" -f "$f" || echo "Warning: $f had errors"
done

echo "Migrations complete."