import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/auth-store';
import { Product, Warehouse } from '@/types';
import { generateId } from '@/utils/helpers';
import { githubSync, GitHubConfig } from '@/utils/github-sync';
import * as Network from 'expo-network';

const WAREHOUSES_STORAGE_KEY = 'warehouses';
const PRODUCTS_STORAGE_KEY = 'products';
const SYNC_MIN_INTERVAL_MS = 5000; 

export const [WarehouseProvider, useWarehouse] = createContextHook(() => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'error'>('synced');
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const isPerformingSyncRef = useRef<boolean>(false);
  const lastSyncRef = useRef<number>(0);
  const pendingSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncPromise = useRef<Promise<void> | null>(null);

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
    // Kick off initial load (reads local storage, loads GitHub config, optional first sync)
    void initializeData();

    return () => {
      if (pendingSyncTimeout.current) {
        clearTimeout(pendingSyncTimeout.current);
      }
    };
  }, [initializeData]);



  const performSyncNow = useCallback(async () => {
    if (!githubConfig) {
      console.log('GitHub not configured, skipping sync');
      return;
    }
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
      console.log('No network connection, sync postponed');
      setSyncStatus('pending');
      return;
    }

    try {
      isPerformingSyncRef.current = true;
      setSyncStatus('syncing');
      const syncedData = await githubSync.syncData(warehouses, products);
      
      // Update local data with synced data only if changed
      const warehousesJson = JSON.stringify(warehouses);
      const productsJson = JSON.stringify(products);
      const newWarehousesJson = JSON.stringify(syncedData.warehouses);
      const newProductsJson = JSON.stringify(syncedData.products);

      if (warehousesJson !== newWarehousesJson) {
        setWarehouses(syncedData.warehouses);
      }
      if (productsJson !== newProductsJson) {
        setProducts(syncedData.products);
      }
      
      // Save synced data locally
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, newWarehousesJson);
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, newProductsJson);
      
      setLastSyncTime(new Date().toISOString());
      setSyncStatus('synced');
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      throw error;
    } finally {
      isPerformingSyncRef.current = false;
    }
  }, [githubConfig, warehouses, products]);
  
  const performSync = useCallback((): Promise<void> => {
    if (pendingSyncPromise.current) {
      return pendingSyncPromise.current;
    }

    const run = async () => {
      if (pendingSyncTimeout.current) {
        clearTimeout(pendingSyncTimeout.current);
        pendingSyncTimeout.current = null;
      }
      await performSyncNow();
      lastSyncRef.current = Date.now();
    };

    const now = Date.now();
    const elapsed = now - lastSyncRef.current;
    if (elapsed >= SYNC_MIN_INTERVAL_MS) {
      pendingSyncPromise.current = run().finally(() => {
        pendingSyncPromise.current = null;
      });
    } else {
      pendingSyncPromise.current = new Promise<void>((resolve, reject) => {
        pendingSyncTimeout.current = setTimeout(() => {
          run().then(resolve).catch(reject);
        }, SYNC_MIN_INTERVAL_MS - elapsed);
      }).finally(() => {
        pendingSyncPromise.current = null;
      });
    }
    return pendingSyncPromise.current;
  }, [performSyncNow]);  

  const saveData = useCallback(async () => {
    try {
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(warehouses));
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      
      if (githubConfig) {
        if (isPerformingSyncRef.current) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('pending');
        }
      } else {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      setSyncStatus('error');
    }
  }, [warehouses, products, githubConfig]);

  useEffect(() => {
    if (!isLoading) {
      saveData();
    }
  }, [warehouses, products, isLoading, saveData]);

  useEffect(() => {
    if (githubConfig && syncStatus === 'pending' && !isPerformingSyncRef.current) {
      performSync().catch((error) => {
        console.error('Auto sync failed:', error);
      });
    }
  }, [githubConfig, syncStatus, performSync]);
  
  useEffect(() => {
    const subscription = Network.addNetworkStateListener(state => {
      if (
        state.isConnected &&
        state.isInternetReachable &&
        syncStatus === 'pending' &&
        githubConfig &&
        !isPerformingSyncRef.current
      ) {
        performSync().catch(error => {
          console.error('Auto sync failed:', error);
        });
      }
    });
    return () => subscription.remove();
  }, [syncStatus, githubConfig, performSync]);

  const { isLoggedIn } = useAuth();
  const wasLoggedInRef = useRef(isLoggedIn);

  useEffect(() => {
    if (isLoggedIn && !wasLoggedInRef.current && githubConfig) {
      performSync().catch(error => {
        console.error('Sync on login failed:', error);
      });
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, githubConfig, performSync]);

  // Warehouse operations
  const addWarehouse = (name: string) => {
    const newWarehouse: Warehouse = {
      id: generateId(),
      name,
      qrOnly: false,
      updatedAt: new Date().toISOString(),
    };
    setWarehouses([...warehouses, newWarehouse]);
    return newWarehouse;
  };

  const updateWarehouse = (id: string, data: Partial<Warehouse>) => {
    setWarehouses(
      warehouses.map(w =>
        w.id === id ? { ...w, ...data, updatedAt: new Date().toISOString() } : w
      )
    );
  };

  const deleteWarehouse = (id: string) => {
    const timestamp = new Date().toISOString();
    setWarehouses(
      warehouses.map(w =>
        w.id === id ? { ...w, deleted: true, updatedAt: timestamp } : w
      )
    );
    // Also mark all products in this warehouse as deleted
    setProducts(
      products.map(p =>
        p.warehouseId === id ? { ...p, deleted: true, updatedAt: timestamp } : p
      )
    );
  };

  const getWarehouse = (id: string) => {
    return warehouses.find(w => w.id === id && !w.deleted);
  };

  // Product operations
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      updatedAt: new Date().toISOString(),
    };
    setProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    setProducts(
      products.map(p =>
        p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const deleteProduct = (id: string) => {
    setProducts(
      products.map(p =>
        p.id === id ? { ...p, deleted: true, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const getProduct = (id: string) => {
    return products.find(p => p.id === id && !p.deleted);
  };

  const getWarehouseProducts = (warehouseId: string) => {
    return products.filter(p => p.warehouseId === warehouseId && !p.deleted);
  };

  const getProductsWithoutBarcode = (warehouseId: string) => {
    return products
      .filter(p => p.warehouseId === warehouseId && !p.barcode && !p.deleted)
      .sort((a, b) =>
        a.location.localeCompare(b.location, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  };

  const getProductsBelowMin = (warehouseId: string) => {
    return products.filter(
      p => p.warehouseId === warehouseId && p.quantity < p.minAmount && !p.deleted
    );
  };

  const getProductsOverstock = (warehouseId: string) => {
    return products.filter(
      p => p.warehouseId === warehouseId && p.quantity > p.maxAmount && !p.deleted
    );
  };

  const findProductByBarcode = (warehouseId: string, barcode: string) => {
    return products.find(
      p => p.warehouseId === warehouseId && p.barcode === barcode && !p.deleted
    );
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
    const timestamp = new Date().toISOString();  
    const newProducts = csvData.map(product => ({
      ...product,
      id: generateId(),
      warehouseId,
      updatedAt: timestamp,
    }));
    
    setProducts([...products, ...newProducts]);
    return newProducts;
  };

  return {
    warehouses: warehouses.filter(w => !w.deleted),
    products: products.filter(p => !p.deleted),
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