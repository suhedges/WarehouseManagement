export interface BaseRecord {
  id: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  deleted?: boolean;
}

export interface Warehouse extends BaseRecord {
  name: string;
  qrOnly?: boolean;
  storeId?: string;
}

export interface Product extends BaseRecord {
  id: string;
  internalName: string;
  customerName: string;
  barcode: string;
  location: string;
  minAmount: number;
  maxAmount: number;
  quantity: number;
  warehouseId: string;
  storeId?: string;
}

export interface WarehouseFile {
  meta: {
    schemaVersion: number;
    lastCompactedAt?: string | null;
  };
  warehouses: Warehouse[];
  products: Product[];
}

export interface ConflictField {
  name: string;
  base: any;
  local: any;
  remote: any;
}

export interface RecordConflict {
  recordId: string;
  recordType: 'warehouse' | 'product';
  warehouseId?: string;
  fields: ConflictField[];
}

export interface User {
  username: string;
}