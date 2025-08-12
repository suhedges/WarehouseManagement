import { RecordConflict, ConflictField } from '@/types';

export interface MergeableRecord {
  id: string;
  version: number;
  deleted?: boolean;
  [key: string]: any;
}

export interface MergeResult<T extends MergeableRecord> {
  records: T[];
  conflicts: RecordConflict[];
}

// Three-way merge for arrays of records.
// BASE: last snapshot pulled by this client
// LOCAL: client working copy
// REMOTE: latest fetched from server
export function mergeRecords<T extends MergeableRecord>(
  base: T[],
  local: T[],
  remote: T[],
  recordType: 'warehouse' | 'product'
): MergeResult<T> {
  const merged: T[] = [];
  const conflicts: RecordConflict[] = [];

  const ids = new Set<string>();
  for (const r of base) ids.add(r.id);
  for (const r of local) ids.add(r.id);
  for (const r of remote) ids.add(r.id);

  ids.forEach((id) => {
    const b = base.find((r) => r.id === id);
    const l = local.find((r) => r.id === id);
    const r = remote.find((r) => r.id === id);

    // Tombstone logic
    const tombstone = chooseTombstone(b, l, r);
    if (tombstone) {
      merged.push(tombstone);
      return;
    }

    const record: any = { id };
    const recordConflicts: ConflictField[] = [];
    const keys = new Set<string>([
      ...Object.keys(b || {}),
      ...Object.keys(l || {}),
      ...Object.keys(r || {}),
    ]);
    keys.delete('version');
    keys.delete('id');

    keys.forEach((key) => {
      const baseVal = b ? b[key] : undefined;
      const localVal = l ? l[key] : undefined;
      const remoteVal = r ? r[key] : undefined;

      if (baseVal === remoteVal && localVal !== baseVal) {
        record[key] = localVal;
      } else if (baseVal === localVal && remoteVal !== baseVal) {
        record[key] = remoteVal;
      } else if (
        l && r &&
        localVal !== baseVal &&
        remoteVal !== baseVal &&
        localVal !== remoteVal
      ) {
        record[key] = baseVal;
        recordConflicts.push({ name: key, base: baseVal, local: localVal, remote: remoteVal });
      } else {
        // default - prefer local then remote then base
        record[key] = localVal ?? remoteVal ?? baseVal;
      }
    });

    const finalVersion = Math.max(b?.version || 0, l?.version || 0, r?.version || 0) + 1;
    record.version = finalVersion;

    merged.push(record as T);
    if (recordConflicts.length > 0) {
      conflicts.push({
        recordId: id,
        recordType,
        warehouseId: record.warehouseId,
        fields: recordConflicts,
      });
    }
  });

  return { records: merged, conflicts };
}

function chooseTombstone<T extends MergeableRecord>(
  b?: T,
  l?: T,
  r?: T
): T | null {
  const candidates = [b, l, r].filter(Boolean) as T[];
  if (candidates.length === 0) return null;

  // pick record with highest version
  const winner = candidates.reduce((acc, cur) =>
    cur.version > acc.version ? cur : acc
  );

  // if winner is deleted and has higher version than any non-deleted record, tombstone wins
  if (winner.deleted) {
    const anyNewerAlive = candidates.some(
      (rec) => !rec.deleted && rec.version > winner.version
    );
    if (!anyNewerAlive) {
      return { ...winner, deleted: true };
    }
  }
  return null;
}