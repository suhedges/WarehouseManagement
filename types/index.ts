export interface Warehouse {
  id: string;
  name: string;
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
}

export interface User {
  username: string;
}