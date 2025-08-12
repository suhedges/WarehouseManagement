import { describe, expect, test } from 'bun:test';
import { mergeRecords, MergeableRecord } from '@/utils/merge-records';

type R = MergeableRecord & { name?: string; quantity?: number; warehouseId?: string };

const baseRecord = (id: string, fields: Partial<R> = {}): R => ({ id, version: 1, ...fields });

describe('mergeRecords three-way', () => {
  test('edits in different warehouses merge cleanly', () => {
    const base = [baseRecord('w1', { name: 'A' }), baseRecord('w2', { name: 'B' })];
    const local = [baseRecord('w1', { name: 'A-local', version: 2 })];
    const remote = [baseRecord('w2', { name: 'B-remote', version: 2 })];
    const result = mergeRecords(base, local, remote, 'warehouse');
    expect(result.conflicts).toHaveLength(0);
    expect(result.records.find(r => r.id === 'w1')?.name).toBe('A-local');
    expect(result.records.find(r => r.id === 'w2')?.name).toBe('B-remote');
  });

  test('same warehouse, different records merge', () => {
    const base = [baseRecord('p1', { warehouseId: 'w1', name: 'A' }), baseRecord('p2', { warehouseId: 'w1', name: 'B' })];
    const local = [baseRecord('p1', { warehouseId: 'w1', name: 'A-local', version: 2 })];
    const remote = [baseRecord('p2', { warehouseId: 'w1', name: 'B-remote', version: 2 })];
    const result = mergeRecords(base, local, remote, 'product');
    expect(result.conflicts).toHaveLength(0);
    expect(result.records.find(r => r.id === 'p1')?.name).toBe('A-local');
    expect(result.records.find(r => r.id === 'p2')?.name).toBe('B-remote');
  });

  test('same record, different fields auto merge', () => {
    const base = [baseRecord('p1', { name: 'A', quantity: 1 })];
    const local = [baseRecord('p1', { name: 'Local', quantity: 1, version: 2 })];
    const remote = [baseRecord('p1', { name: 'A', quantity: 2, version: 2 })];
    const result = mergeRecords(base, local, remote, 'product');
    expect(result.conflicts).toHaveLength(0);
    const rec = result.records[0];
    expect(rec.name).toBe('Local');
    expect(rec.quantity).toBe(2);
  });

  test('same record same field yields conflict', () => {
    const base = [baseRecord('p1', { name: 'A' })];
    const local = [baseRecord('p1', { name: 'B', version: 2 })];
    const remote = [baseRecord('p1', { name: 'C', version: 2 })];
    const result = mergeRecords(base, local, remote, 'product');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].fields[0].local).toBe('B');
  });

  test('tombstone beats older edit', () => {
    const base = [baseRecord('p1', { name: 'A', deleted: false })];
    const local = [baseRecord('p1', { name: 'A', deleted: true, version: 3 })];
    const remote = [baseRecord('p1', { name: 'Remote', version: 2 })];
    const result = mergeRecords(base, local, remote, 'product');
    const rec = result.records[0];
    expect(rec.deleted).toBe(true);
  });
});