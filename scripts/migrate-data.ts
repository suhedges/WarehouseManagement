import fs from 'fs';

const FILE = 'warehouse-data.json';
const now = new Date().toISOString();

if (!fs.existsSync(FILE)) {
  console.error('warehouse-data.json not found');
  process.exit(1);
}

const raw = fs.readFileSync(FILE, 'utf-8');
const data = JSON.parse(raw);

data.meta = { schemaVersion: 1, lastCompactedAt: null };

const stamp = (r: any) => ({
  id: r.id,
  ...r,
  version: 1,
  updatedAt: r.updatedAt || now,
  updatedBy: 'migration',
  deleted: r.deleted ?? false,
});

data.warehouses = (data.warehouses || []).map(stamp);

data.products = (data.products || []).map(stamp);

fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log('Migration complete');