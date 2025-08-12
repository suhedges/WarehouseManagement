# \## GitHub backed sync

# 

# This project keeps warehouse and product data in a single JSON file stored in

# GitHub. Multiple users may work on the data concurrently.  The sync layer uses a

# three-way merge with optimistic concurrency and per-field conflict detection.

# 

# \### Migrating existing data

# 

# Add the new metadata (`version`, `updatedAt`, `updatedBy`, `deleted` and

# top‑level `meta`) to an existing `warehouse-data.json` by running:

# 

# ```bash

# bun tsx scripts/migrate-data.ts

# ```

# 

# \### Running tests

# 

# ```bash

# bun test

# ```

# 

# \### Risky scenarios \& how this code handles them

# 

# \- \*\*Simultaneous edits\*\* – Each client merges against a local BASE snapshot. If

# &nbsp; two users change the same field a conflict entry is produced rather than one

# &nbsp; side silently winning.

# \- \*\*Offline edits\*\* – Edits made against an old BASE snapshot merge with the

# &nbsp; latest REMOTE data; any overlapping fields create conflicts instead of

# &nbsp; overwriting newer data.

# \- \*\*Delete vs edit\*\* – Deletions are represented with a tombstone and always win

# &nbsp; over an older non‑deleted record to prevent “resurrection”.

# \- \*\*SHA collisions\*\* – Pushes include the last known file SHA via the

# &nbsp; `If-Match` header; GitHub rejects outdated SHAs so we can pull, merge and retry

# &nbsp; without clobbering remote changes.

