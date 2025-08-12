export interface Warehouse {
  id: string;
  name: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Product {
  id: string;
  internalName: string;
  customerName: string;
  barcode: string;
  location: string;
  minAmount: number;
  maxAmount: number;
  quantity: number;
  warehouseId: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface User {
  username: string;
}