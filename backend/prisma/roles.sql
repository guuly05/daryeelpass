-- Run with psql as the database owner after migrations.
-- Supply a unique local value: psql "$DIRECT_URL" -v runtime_password="..." -f prisma/roles.sql
SELECT format('CREATE ROLE daryeelpass_app LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daryeelpass_app')
\gexec
ALTER ROLE daryeelpass_app LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE daryeelpass TO daryeelpass_app;
GRANT USAGE ON SCHEMA public TO daryeelpass_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO daryeelpass_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO daryeelpass_app;
ALTER DEFAULT PRIVILEGES FOR ROLE daryeelpass IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO daryeelpass_app;
ALTER DEFAULT PRIVILEGES FOR ROLE daryeelpass IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO daryeelpass_app;
