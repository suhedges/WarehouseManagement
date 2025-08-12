export interface Mergeable {
  id: string;
  updatedAt?: string;
}

export function mergeRecords<T extends Mergeable>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();

  for (const r of remote) {
    map.set(r.id, r);
  }

  for (const l of local) {
    const existing = map.get(l.id);
    if (existing) {
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const localTime = new Date(l.updatedAt || 0).getTime();
      if (localTime > existingTime) {
        map.set(l.id, l);
      }
    } else {
      map.set(l.id, l);
    }
  }

  return Array.from(map.values());
}