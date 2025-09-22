# \## GitHub backed sync

# This project keeps warehouse and product data in GitHub. Each user (or branch) pushes to a dedicated JSON file named `warehouse-data-<username>.json`, which keeps concurrent edits isolated and dramatically reduces merge conflicts. The sync layer still performs a three-way merge with optimistic concurrency and per-field conflict detection, but isolating data per user means fewer SHA collisions in the first place.

# GitHub. Multiple users may work on the data concurrently. Splitting into per-user files

# ```bash bun tsx scripts/split-warehouse-data.ts path/to/warehouse-data.json [output-directory] ```

# After splitting, run the migration script on each generated file to ensure the required metadata fields are present:

# ```bash bun tsx scripts/migrate-data.ts warehouse-data-<username>.json ```

# Add the new metadata (`version`, `updatedAt`, `updatedBy`, `deleted` and

# Risky scenarios & how this code handles them

# **Simultaneous edits** – Each client merges against a local BASE snapshot. If two users change the same field a conflict entry is produced rather than one side silently winning. **Offline edits** – Edits made against an old BASE snapshot merge with the latest REMOTE data; any overlapping fields create conflicts instead of overwriting newer data. **Delete vs edit** – Deletions are represented with a tombstone and always win over an older non-deleted record to prevent “resurrection”. **SHA collisions** – Pushes include the last known file SHA via the `If-Match` header; GitHub rejects outdated SHAs so we can pull, merge and retry without clobbering remote changes.

# Sync timing and rate limiting

# Sync attempts are throttled to run at most once every 5 seconds. Calls to `performSync` queue up and execute after this interval to keep network traffic and GitHub usage under control.

# API responds with 403 or 429, requests pause and retry with exponential backoff,

# GitHub requests inspect `X-RateLimit-Remaining` and `Retry-After` headers. When the API responds with 403 or 429, requests pause and retry with exponential backoff, honoring any server-provided `Retry-After` delay.