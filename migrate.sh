
Copy

#!/bin/sh
# migrate.sh — run all SQL migrations in order
# Called before starting the app in production
 
set -e
 
echo "Running migrations..."
 
for f in $(ls db/migrations/*.sql | sort); do
  echo "→ $f"
  psql "$DATABASE_URL" -f "$f"
done
 
echo "Migrations complete."
 