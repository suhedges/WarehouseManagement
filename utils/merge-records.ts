import { RecordConflict, ConflictField } from '@/types';

export interface MergeableRecord {
  id: string;
  version: number;
  updatedAt?: string;
  deleted?: boolean;
  [key: string]: any;
}

export interface MergeResult<T extends MergeableRecord> {
  records: T[];
  conflicts: RecordConflict[];
}

// Three-way merge preferring the most recently updated value on conflicting fields
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
      const baseVal = b ? (b as any)[key] : undefined;
      const localVal = l ? (l as any)[key] : undefined;
      const remoteVal = r ? (r as any)[key] : undefined;

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
        const localUpdated = l.updatedAt ? Date.parse(l.updatedAt) : 0;
        const remoteUpdated = r.updatedAt ? Date.parse(r.updatedAt) : 0;
        if (localUpdated === remoteUpdated) {
          record[key] = localVal; // prefer local on exact tie
          recordConflicts.push({ name: key, base: baseVal, local: localVal, remote: remoteVal });
        } else if (localUpdated > remoteUpdated) {
          record[key] = localVal;
        } else {
          record[key] = remoteVal;
        }
      } else {
        record[key] = localVal ?? remoteVal ?? baseVal;
      }
    });

    const finalVersion = Math.max(b?.version || 0, l?.version || 0, r?.version || 0) + 1;
    record.version = finalVersion;
    record.updatedAt = (l?.updatedAt && r?.updatedAt)
      ? (Date.parse(l.updatedAt) > Date.parse(r.updatedAt) ? l.updatedAt : r.updatedAt)
      : (l?.updatedAt ?? r?.updatedAt ?? b?.updatedAt);

    merged.push(record as T);
    if (recordConflicts.length > 0) {
      conflicts.push({
        recordId: id,
        recordType,
        warehouseId: (record as any).warehouseId,
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

  const winner = candidates.reduce((acc, cur) =>
    cur.version > acc.version ? cur : acc
  );

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