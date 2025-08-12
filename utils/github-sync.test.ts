import { describe, expect, test } from 'bun:test';
import { mergeRecords } from '@/utils/merge-records';

type Item = { id: string; updatedAt: string; name?: string; deleted?: boolean };

describe('mergeRecords', () => {
  test('returns remote data when local is empty', () => {
    const remote: Item[] = [{ id: '1', name: 'remote', updatedAt: '2023-01-01T00:00:00Z' }];
    const result = mergeRecords<Item>([], remote);
    expect(result).toEqual(remote);
  });

  test('merges non-conflicting records', () => {
    const local: Item[] = [{ id: '1', name: 'local', updatedAt: '2023-01-02T00:00:00Z' }];
    const remote: Item[] = [{ id: '2', name: 'remote', updatedAt: '2023-01-01T00:00:00Z' }];
    const result = mergeRecords<Item>(local, remote);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === '1')?.name).toBe('local');
    expect(result.find(r => r.id === '2')?.name).toBe('remote');
  });

  test('picks newer record on conflict', () => {
    const local: Item[] = [{ id: '1', name: 'local', updatedAt: '2023-01-03T00:00:00Z' }];
    const remote: Item[] = [{ id: '1', name: 'remote', updatedAt: '2023-01-02T00:00:00Z' }];
    const result = mergeRecords<Item>(local, remote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('local');
  });

  test('respects deletions when newer', () => {
    const local: Item[] = [{ id: '1', name: 'local', updatedAt: '2023-01-03T00:00:00Z', deleted: true }];
    const remote: Item[] = [{ id: '1', name: 'remote', updatedAt: '2023-01-02T00:00:00Z' }];
    const result = mergeRecords<Item>(local, remote);
    expect(result[0].deleted).toBe(true);
  });
});