import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { Product, Warehouse } from '@/types';
import { generateId } from '@/utils/helpers';
import { githubSync, GitHubConfig } from '@/utils/github-sync';

const WAREHOUSES_STORAGE_KEY = 'warehouses';
const PRODUCTS_STORAGE_KEY = 'products';

export const [WarehouseProvider, useWarehouse] = createContextHook(() => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'error'>('synced');
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load GitHub config first
      const config = await githubSync.loadConfig();
      setGithubConfig(config);
      
      // Load local data first
      const storedWarehouses = await AsyncStorage.getItem(WAREHOUSES_STORAGE_KEY);
      const storedProducts = await AsyncStorage.getItem(PRODUCTS_STORAGE_KEY);
      
      let localWarehouses: Warehouse[] = [];
      let localProducts: Product[] = [];
      
      if (storedWarehouses) {
        localWarehouses = JSON.parse(storedWarehouses);
        setWarehouses(localWarehouses);
      }
      
      if (storedProducts) {
        localProducts = JSON.parse(storedProducts);
        setProducts(localProducts);
      }
      
      // If GitHub is configured, try to sync
      if (config) {
        try {
          const syncedData = await githubSync.syncData(localWarehouses, localProducts);
          setWarehouses(syncedData.warehouses);
          setProducts(syncedData.products);
          await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(syncedData.warehouses));
          await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(syncedData.products));
          setLastSyncTime(new Date().toISOString());
          setSyncStatus('synced');
        } catch (error) {
          console.error('Initial sync failed:', error);
          setSyncStatus('error');
        }
      }
    } catch (error) {
      console.error('Failed to initialize data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeData();
  }, [initializeData]);



  const performSync = useCallback(async () => {
    if (!githubConfig) {
      console.log('GitHub not configured, skipping sync');
      return;
    }

    try {
      setSyncStatus('syncing');
      const syncedData = await githubSync.syncData(warehouses, products);
      
      // Update local data with synced data
      setWarehouses(syncedData.warehouses);
      setProducts(syncedData.products);
      
      // Save synced data locally
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(syncedData.warehouses));
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(syncedData.products));
      
      setLastSyncTime(new Date().toISOString());
      setSyncStatus('synced');
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      throw error;
    }
  }, [githubConfig, warehouses, products]);

  const saveData = useCallback(async () => {
    try {
      setSyncStatus('pending');
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(warehouses));
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      
      // If GitHub is configured, sync to GitHub
      if (githubConfig) {
        await performSync();
      } else {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      setSyncStatus('error');
    }
  }, [warehouses, products, githubConfig, performSync]);

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

  const findProductByBarcode = (warehouseId: string, barcode: string) => {
    return products.find(p => p.warehouseId === warehouseId && p.barcode === barcode);
  };

  // GitHub sync functions
  const configureGitHub = async (config: GitHubConfig) => {
    try {
      await githubSync.saveConfig(config);
      setGithubConfig(config);
      
      // Perform initial sync after configuration
      await performSync();
    } catch (error) {
      console.error('Failed to configure GitHub:', error);
      throw error;
    }
  };



  const disconnectGitHub = async () => {
    try {
      await githubSync.clearConfig();
      setGithubConfig(null);
      setLastSyncTime(null);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
      throw error;
    }
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
    githubConfig,
    lastSyncTime,
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
    findProductByBarcode,
    importProducts,
    configureGitHub,
    performSync,
    disconnectGitHub,
  };
});