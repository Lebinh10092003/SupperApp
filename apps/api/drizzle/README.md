# Canonical migration chain

This directory is the only active Drizzle migration path. Migration `0000`
is a clean baseline generated from the application schemas after the live
production PostgreSQL schema was approved as authoritative on 2026-10-06.

Fresh databases run this chain from zero. An existing production database must
first pass the read-only schema fingerprint check and then be adopted with the
explicit metadata-only adoption command. The baseline DDL must never be replayed
against an adopted database.

Historical migrations are preserved, but inactive, in `../drizzle-legacy/`.
All future schema changes must be generated as new forward-only migrations in
this directory.
