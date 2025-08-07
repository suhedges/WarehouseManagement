import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { Product, Warehouse } from '@/types';
import { generateId } from '@/utils/helpers';

const WAREHOUSES_STORAGE_KEY = 'warehouses';
const PRODUCTS_STORAGE_KEY = 'products';

export const [WarehouseProvider, useWarehouse] = createContextHook(() => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending'>('synced');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const storedWarehouses = await AsyncStorage.getItem(WAREHOUSES_STORAGE_KEY);
      const storedProducts = await AsyncStorage.getItem(PRODUCTS_STORAGE_KEY);
      
      if (storedWarehouses) {
        setWarehouses(JSON.parse(storedWarehouses));
      }
      
      if (storedProducts) {
        setProducts(JSON.parse(storedProducts));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = useCallback(async () => {
    try {
      setSyncStatus('pending');
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(warehouses));
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      setSyncStatus('synced');
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }, [warehouses, products]);

  useEffect(() => {
    if (!isLoading) {
      saveData();
    }
  }, [warehouses, products, isLoading, saveData]);

  // Warehouse operations
  const addWarehouse = (name: string) => {
    const newWarehouse: Warehouse = {
      id: generateId(),
      name,
    };
    setWarehouses([...warehouses, newWarehouse]);
    return newWarehouse;
  };

  const updateWarehouse = (id: string, data: Partial<Warehouse>) => {
    setWarehouses(warehouses.map(w => w.id === id ? { ...w, ...data } : w));
  };

  const deleteWarehouse = (id: string) => {
    setWarehouses(warehouses.filter(w => w.id !== id));
    // Also delete all products in this warehouse
    setProducts(products.filter(p => p.warehouseId !== id));
  };

  const getWarehouse = (id: string) => {
    return warehouses.find(w => w.id === id);
  };

  // Product operations
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
    };
    setProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const getProduct = (id: string) => {
    return products.find(p => p.id === id);
  };

  const getWarehouseProducts = (warehouseId: string) => {
    return products.filter(p => p.warehouseId === warehouseId);
  };

  const getProductsWithoutBarcode = (warehouseId: string) => {
    return products
      .filter(p => p.warehouseId === warehouseId && !p.barcode)
      .sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: 'base' }));
  };

  const getProductsBelowMin = (warehouseId: string) => {
    return products.filter(p => p.warehouseId === warehouseId && p.quantity < p.minAmount);
  };

  const getProductsOverstock = (warehouseId: string) => {
    return products.filter(p => p.warehouseId === warehouseId && p.quantity > p.maxAmount);
  };

  // Import/Export
  const importProducts = (warehouseId: string, csvData: Product[]) => {
    const newProducts = csvData.map(product => ({
      ...product,
      id: generateId(),
      warehouseId
    }));
    
    setProducts([...products, ...newProducts]);
    return newProducts;
  };

  return {
    warehouses,
    products,
    isLoading,
    syncStatus,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    getWarehouse,
    addProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    getWarehouseProducts,
    getProductsWithoutBarcode,
    getProductsBelowMin,
    getProductsOverstock,
    importProducts,
  };
});