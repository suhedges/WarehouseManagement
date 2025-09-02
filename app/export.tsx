import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  Platform,
  Share as RNShare,
  AlertButton,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { exportCSV } from '@/utils/helpers';
import * as Sharing from 'expo-sharing';
import { 
  Download, 
  X, 
  Package, 
  AlertTriangle, 
  AlertCircle 
} from 'lucide-react-native';

type ProductLike = {
  quantity?: number | string;
  qty?: number | string;
  onHand?: number | string;
  min?: number | string;
  minQty?: number | string;
  minimum?: number | string;
  max?: number | string;
  maxQty?: number | string;
  maximum?: number | string;
  [key: string]: any;
};

const toNumber = (v: any): number => {
  if (v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
};

export default function ExportScreen() {
  const params = useLocalSearchParams<{ warehouseId: string }>();
  const router = useRouter();
  const { 
    getWarehouse, 
    getWarehouseProducts, 
    getProductsBelowMin, 
    getProductsOverstock 
  } = useWarehouse();
  
  const [isLoading, setIsLoading] = useState(false);
  
  const warehouse = getWarehouse(params.warehouseId);
  const allProducts: ProductLike[] = getWarehouseProducts(params.warehouseId) || [];
  const productsBelowMin: ProductLike[] = getProductsBelowMin(params.warehouseId) || [];
  const productsOverstock: ProductLike[] = getProductsOverstock(params.warehouseId) || [];

  // Under Max = quantity >= min && quantity < max (excludes under-min and over-max)
  const productsUnderMax: ProductLike[] = useMemo(() => {
    return (allProducts || []).filter((p: ProductLike) => {
      const qty = toNumber(p.quantity ?? p.qty ?? p.onHand);
      const min = toNumber(p.min ?? p.minQty ?? p.minimum);
      const max = toNumber(p.max ?? p.maxQty ?? p.maximum);
      if ([qty, min, max].some(Number.isNaN)) return false;
      return qty >= min && qty < max;
    });
  }, [allProducts]);

  const handleExportAll = async () => {
    await handleExport(allProducts, 'all-products');
  };

  const handleExportBelowMin = async () => {
    await handleExport(productsBelowMin, 'below-min-products');
  };

  const handleExportUnderMax = async () => {
    await handleExport(productsUnderMax, 'under-max-products');
  };

  const handleExportOverstock = async () => {
    await handleExport(productsOverstock, 'overstock-products');
  };

  const handleExport = async (products: ProductLike[], filePrefix: string) => {
    if (!products || products.length === 0) {
      Alert.alert('No Data', 'There are no products to export');
      return;
    }
    
    setIsLoading(true);
    try {
      const warehouseName = warehouse?.name?.replace(/\s+/g, '-').toLowerCase() || 'warehouse';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${warehouseName}-${filePrefix}-${timestamp}.csv`;
      
      const fileUri = await exportCSV(products as any, filename);

      if (fileUri !== null) {
        const where = Platform.OS === 'android'
          ? 'Downloads (or the folder you chose)'
          : 'your Files/Share target';
        const shareFile = async () => {
          if (!fileUri) return;
          try {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: filename,
                UTI: 'public.comma-separated-values-text',
              });
            } else {
              await RNShare.share({
                url: fileUri,
                title: filename,
                message: `Exported ${products.length} products to ${filename}`,
              });
            }
          } catch (e) {
            console.warn('Share failed', e);
          }
        };

        const buttons: AlertButton[] = fileUri
          ? [
              { text: 'Share', onPress: shareFile },
              { text: 'OK', style: 'cancel' as const },
            ]
          : [{ text: 'OK', style: 'cancel' as const }];

        Alert.alert(
          'Export Successful',
          `Saved ${products.length} items to ${where}.`,
          buttons
        );
      } else {
        Alert.alert('Export Failed', 'Failed to export products');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Text style={styles.title}>Export Products</Text>
          {warehouse && (
            <Text style={styles.warehouseName}>Warehouse: {warehouse.name}</Text>
          )}
          
          <View style={styles.exportOption}>
            <View style={styles.exportInfo}>
              <Package size={24} color={colors.primary} />
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportTitle}>All Products</Text>
                <Text style={styles.exportDescription}>
                  Export all {allProducts.length} products in this warehouse
                </Text>
              </View>
            </View>
            <Button
              title="Export"
              onPress={handleExportAll}
              loading={isLoading}
              disabled={isLoading || allProducts.length === 0}
              icon={<Download size={18} color="white" />}
              style={styles.exportButton}
            />
          </View>

          <View style={styles.exportOption}>
            <View style={styles.exportInfo}>
              <AlertTriangle size={24} color={colors.warning} />
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportTitle}>Below Minimum</Text>
                <Text style={styles.exportDescription}>
                  Export {productsBelowMin.length} products below minimum quantity
                </Text>
              </View>
            </View>
            <Button
              title="Export"
              onPress={handleExportBelowMin}
              loading={isLoading}
              disabled={isLoading || productsBelowMin.length === 0}
              icon={<Download size={18} color="white" />}
              style={styles.exportButton}
              variant={productsBelowMin.length > 0 ? 'primary' : 'outline'}
            />
          </View>

          <View style={styles.exportOption}>
            <View style={styles.exportInfo}>
              <AlertCircle size={24} color={colors.primary} />
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportTitle}>Under Max</Text>
                <Text style={styles.exportDescription}>
                  Export {productsUnderMax.length} products between min and max
                </Text>
              </View>
            </View>
            <Button
              title="Export"
              onPress={handleExportUnderMax}
              loading={isLoading}
              disabled={isLoading || productsUnderMax.length === 0}
              icon={<Download size={18} color="white" />}
              style={styles.exportButton}
              variant={productsUnderMax.length > 0 ? 'primary' : 'outline'}
            />
          </View>
          
          <View style={styles.exportOption}>
            <View style={styles.exportInfo}>
              <AlertCircle size={24} color={colors.primary} />
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportTitle}>Overstock</Text>
                <Text style={styles.exportDescription}>
                  Export {productsOverstock.length} products above maximum quantity
                </Text>
              </View>
            </View>
            <Button
              title="Export"
              onPress={handleExportOverstock}
              loading={isLoading}
              disabled={isLoading || productsOverstock.length === 0}
              icon={<Download size={18} color="white" />}
              style={styles.exportButton}
              variant={productsOverstock.length > 0 ? 'primary' : 'outline'}
            />
          </View>
          
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="outline"
            icon={<X size={18} color={colors.primary} />}
            style={styles.cancelButton}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  warehouseName: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 24,
  },
  exportOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  exportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exportTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exportDescription: {
    fontSize: 14,
    color: colors.gray[600],
  },
  exportButton: {
    minWidth: 100,
  },
  cancelButton: {
    marginTop: 24,
  },
});
