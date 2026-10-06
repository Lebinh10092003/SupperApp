# Legacy migration archive

The files in this directory are the preserved `0000`–`0018` migration
history copied from the production VPS on 2026-10-06.

They are retained for audit purposes only. They are not a safe fresh-install
path: the old chain has no trustworthy production ledger, `0010` contains a
UTF-8 BOM, `0016`/`0017` duplicate table creation, and later production schema
changes are missing from the chain.

Do not point Drizzle migration tooling at this directory and do not edit these
files to reconstruct an assumed production history. The active, canonical
migration chain is `../drizzle/`.
