# Use ENV var for database and ports

- Change DB_NAME from escuela -> wpm_db
- Use ENV vars for DB connection (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- Standardize port mapping (4001/5433) via ENV

Assigned reviewer (human): PENDING — requires manual review of DB/env changes (wpm_db, DB_PORT 5432, API_URL 4001)
