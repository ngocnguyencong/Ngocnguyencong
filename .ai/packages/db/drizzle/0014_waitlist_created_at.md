# drizzle/0014_waitlist_created_at.sql

Adds a B-tree index on `waitlist_entry.created_at`. FIFO position counts all
statuses, so the status-first admin index cannot serve the public rank query.
The schema, snapshot, migration journal, and migration-artifact test include
the new index.
