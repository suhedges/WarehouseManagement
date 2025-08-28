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

  const { isLoggedIn, user } = useAuth();

  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load GitHub config first
      const config = await githubSync.loadConfig();
      setGithubConfig(config);

      githubSync.setUser(user?.username ?? 'local');
      
      // Load local data first
      const storedWarehouses = await AsyncStorage.getItem(WAREHOUSES_STORAGE_KEY);
      const storedProducts = await AsyncStorage.getItem(PRODUCTS_STORAGE_KEY);
      
      let localWarehouses: Warehouse[] = [];
      let localProducts: Product[] = [];
      
      if (storedWarehouses) {
        localWarehouses = JSON.parse(storedWarehouses);
      }
      
      if (storedProducts) {
        localProducts = JSON.parse(storedProducts);
      }

      const normalizedLocalWarehouses = localWarehouses.map(w => ({ ...w, storeId: w.storeId ?? (w.updatedBy || 'local') }));
      const normalizedLocalProducts = localProducts.map(p => ({ ...p, storeId: p.storeId ?? (p.updatedBy || 'local') }));

      setWarehouses(normalizedLocalWarehouses);
      setProducts(normalizedLocalProducts);
      
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

  useEffect(() => {
    githubSync.setUser(user?.username ?? 'local');
  }, [user?.username]);



  const purgeDeletedRecords = useCallback(async () => {
    try {
      const beforeW = warehouses.length;
      const beforeP = products.length;
      const purgedWarehouses = warehouses.filter(w => !w.deleted);
      const purgedProducts = products.filter(p => !p.deleted);
      const afterW = purgedWarehouses.length;
      const afterP = purgedProducts.length;
      if (beforeW !== afterW || beforeP !== afterP) {
        console.log('purgeDeletedRecords: purging deleted items', { beforeW, afterW, beforeP, afterP });
      } else {
        console.log('purgeDeletedRecords: nothing to purge');
      }
      setWarehouses(purgedWarehouses);
      setProducts(purgedProducts);
      await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(purgedWarehouses));
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(purgedProducts));
    } catch (e) {
      console.error('purgeDeletedRecords failed', e);
    }
  }, [warehouses, products]);

  const performSyncNow = useCallback(async () => {
    if (!githubConfig) {
      console.log('GitHub not configured, skipping push');
      return;
    }
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
      console.log('No network connection, push postponed');
      setSyncStatus('pending');
      return;
    }

    try {
      isPerformingSyncRef.current = true;
      setSyncStatus('syncing');
      const currentUser = user?.username ?? 'local';
      const warehousesToPush = warehouses.filter(w => (w.storeId ?? 'local') === currentUser && !w.deleted);
      const productsToPush = products.filter(p => (p.storeId ?? 'local') === currentUser && !p.deleted);
      await githubSync.pushLocalOnly(
        warehousesToPush,
        productsToPush,
      );
      await purgeDeletedRecords();
      setLastSyncTime(new Date().toISOString());
      setSyncStatus('synced');
      console.log('Push completed successfully');
    } catch (error) {
      console.error('Push failed:', error);
      setSyncStatus('error');
      throw error;
    } finally {
      isPerformingSyncRef.current = false;
    }
  }, [githubConfig, warehouses, products, user?.username, purgeDeletedRecords]);
  
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
  
  const saveData = useCallback(
    async (
      w: Warehouse[] = warehouses,
      p: Product[] = products
    ) => {
      try {
        await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(w));
        await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(p));

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
    },
    [warehouses, products, githubConfig]
  );

  useEffect(() => {
    if (!isLoading) {
      saveData();
    }
  }, [warehouses, products, isLoading, saveData]);

  useEffect(() => {
    if (githubConfig && syncStatus === 'pending' && !isPerformingSyncRef.current) {
      performSync().catch((error) => {
        console.error('Auto push failed:', error);
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
          console.error('Auto push failed:', error);
        });
      }
    });
    return () => subscription.remove();
  }, [syncStatus, githubConfig, performSync]);

  const wasLoggedInRef = useRef(isLoggedIn);

  useEffect(() => {
    const pullOnLogin = async () => {
      try {
        if (!githubConfig) return;
        setSyncStatus('syncing');
        const remote = await githubSync.pullRemoteOnLogin();
        if (remote) {
          const normalizedRemoteWarehouses = remote.warehouses.map(w => ({ ...w, storeId: w.storeId ?? (w.updatedBy || 'local') }));
          const normalizedRemoteProducts = remote.products.map(p => ({ ...p, storeId: p.storeId ?? (p.updatedBy || 'local') }));
          setWarehouses(normalizedRemoteWarehouses);
          setProducts(normalizedRemoteProducts);
          await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(normalizedRemoteWarehouses));
          await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(normalizedRemoteProducts));
        }
        setLastSyncTime(new Date().toISOString());
        setSyncStatus('synced');
      } catch (error) {
        console.error('Pull on login failed:', error);
        setSyncStatus('error');
      }
    };

    if (isLoggedIn && !wasLoggedInRef.current) {
      void pullOnLogin();
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, githubConfig]);

  // Warehouse operations
  const currentStoreId = user?.username ?? 'local';

  const addWarehouse = (name: string) => {
    const newWarehouse: Warehouse = {
      id: generateId(),
      name,
      qrOnly: false,
      version: 1,
      updatedBy: user?.username ?? 'local',
      updatedAt: new Date().toISOString(),
      storeId: currentStoreId,
    };
    setWarehouses([...warehouses, newWarehouse]);
    return newWarehouse;
  };

  const updateWarehouse = (id: string, data: Partial<Warehouse>) => {
    setWarehouses(prev => {
      const updated = prev.map(w =>
        w.id === id && w.storeId === currentStoreId
          ? {
              ...w,
              ...data,
              version: (w.version ?? 0) + 1,
              updatedBy: user?.username ?? 'local',
              updatedAt: new Date().toISOString(),
              storeId: w.storeId ?? currentStoreId,
            }
          : w
      );
      saveData(updated, products);
      return updated;
    });
  };

  const deleteWarehouse = (id: string) => {
    const timestamp = new Date().toISOString();
    setWarehouses(
      warehouses.map(w =>
        w.id === id && w.storeId === currentStoreId
          ? { ...w, deleted: true, version: (w.version ?? 0) + 1, updatedBy: user?.username ?? 'local', updatedAt: timestamp }
          : w
      )
    );
    setProducts(
      products.map(p =>
        p.warehouseId === id && p.storeId === currentStoreId
          ? { ...p, deleted: true, version: (p.version ?? 0) + 1, updatedBy: user?.username ?? 'local', updatedAt: timestamp }
          : p
      )
    );
  };

  const getWarehouse = (id: string) => {
    return warehouses.find(w => w.id === id && !w.deleted && w.storeId === currentStoreId);
  };

  // Product operations
  type AddProductInput = Omit<Product, 'id' | 'version' | 'updatedAt' | 'updatedBy'>;
  const addProduct = (product: AddProductInput) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      version: 1,
      updatedBy: user?.username ?? 'local',
      updatedAt: new Date().toISOString(),
      storeId: currentStoreId,
    };
    setProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    setProducts(
      products.map(p =>
        p.id === id && p.storeId === currentStoreId
          ? {
              ...p,
              ...data,
              version: (p.version ?? 0) + 1,
              updatedBy: user?.username ?? 'local',
              updatedAt: new Date().toISOString(),
              storeId: p.storeId ?? currentStoreId,
            }
          : p
      )
    );
  };

  const deleteProduct = (id: string) => {
    setProducts(
      products.map(p =>
        p.id === id && p.storeId === currentStoreId
          ? { ...p, deleted: true, version: (p.version ?? 0) + 1, updatedBy: user?.username ?? 'local', updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const getProduct = (id: string) => {
    return products.find(p => p.id === id && !p.deleted && p.storeId === currentStoreId);
  };

  const getWarehouseProducts = (warehouseId: string) => {
    return products.filter(p => p.warehouseId === warehouseId && !p.deleted && p.storeId === currentStoreId);
  };

  const getProductsWithoutBarcode = (warehouseId: string) => {
    return products
      .filter(p => p.warehouseId === warehouseId && !p.barcode && !p.deleted && p.storeId === currentStoreId)
      .sort((a, b) =>
        a.location.localeCompare(b.location, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  };

  const getProductsBelowMin = (warehouseId: string) => {
    return products.filter(
      p => p.warehouseId === warehouseId && p.quantity < p.minAmount && !p.deleted && p.storeId === currentStoreId
    );
  };

  const getProductsOverstock = (warehouseId: string) => {
    return products.filter(
      p => p.warehouseId === warehouseId && p.quantity > p.maxAmount && !p.deleted && p.storeId === currentStoreId
    );
  };

  const findProductByBarcode = (warehouseId: string, barcode: string) => {
    return products.find(
      p => p.warehouseId === warehouseId && p.barcode === barcode && !p.deleted && p.storeId === currentStoreId
    );
  };

  // GitHub sync functions
  const configureGitHub = async (config: GitHubConfig) => {
    try {
      await githubSync.saveConfig(config);
      setGithubConfig(config);

      githubSync.setUser(user?.username ?? 'local');

      if (isLoggedIn) {
        setSyncStatus('syncing');
        const remote = await githubSync.pullRemoteOnLogin();
        if (remote) {
          const normalizedRemoteWarehouses = remote.warehouses.map(w => ({ ...w, storeId: w.storeId ?? (w.updatedBy || 'local') }));
          const normalizedRemoteProducts = remote.products.map(p => ({ ...p, storeId: p.storeId ?? (p.updatedBy || 'local') }));
          setWarehouses(normalizedRemoteWarehouses);
          setProducts(normalizedRemoteProducts);
          await AsyncStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(normalizedRemoteWarehouses));
          await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(normalizedRemoteProducts));
        }
        setLastSyncTime(new Date().toISOString());
        setSyncStatus('synced');
      }
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

  const resetSyncSnapshot = async () => {
    try {
      await githubSync.resetBaseSnapshot();
      setSyncStatus('pending');
    } catch (error) {
      console.error('Failed to reset sync snapshot:', error);
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
      version: 1,
      updatedBy: user?.username ?? 'local',
      updatedAt: timestamp,
      storeId: currentStoreId,
    }));
    
    setProducts([...products, ...newProducts]);
    return newProducts;
  };

  return {
    warehouses: warehouses.filter(w => !w.deleted && w.storeId === currentStoreId),
    products: products.filter(p => !p.deleted && p.storeId === currentStoreId),
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
    resetSyncSnapshot,
  };
});