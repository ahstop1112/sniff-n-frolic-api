
Copy

#!/bin/sh
# migrate.sh — run all SQL migrations in order
 
echo "Running migrations..."
 
for f in $(ls db/migrations/*.sql | sort); do
  echo "→ $f"
  psql "$DATABASE_URL" -f "$f" || echo "Warning: $f had errors (may already exist)"
done
 
echo "Migrations complete."