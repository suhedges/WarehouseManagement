import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { exportCSV } from '@/utils/helpers';
import { 
  Download, 
  X, 
  Package, 
  AlertTriangle, 
  AlertCircle 
} from 'lucide-react-native';

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
  const allProducts = getWarehouseProducts(params.warehouseId);
  const productsBelowMin = getProductsBelowMin(params.warehouseId);
  const productsOverstock = getProductsOverstock(params.warehouseId);

  const handleExportAll = async () => {
    await handleExport(allProducts, 'all-products');
  };

  const handleExportBelowMin = async () => {
    await handleExport(productsBelowMin, 'below-min-products');
  };

  const handleExportOverstock = async () => {
    await handleExport(productsOverstock, 'overstock-products');
  };

  const handleExport = async (products: any[], filePrefix: string) => {
    if (products.length === 0) {
      Alert.alert('No Data', 'There are no products to export');
      return;
    }
    
    setIsLoading(true);
    try {
      const warehouseName = warehouse?.name.replace(/\s+/g, '-').toLowerCase() || 'warehouse';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${warehouseName}-${filePrefix}-${timestamp}.csv`;
      
      const success = await exportCSV(products, filename);
      
      if (success) {
        Alert.alert('Export Successful', `Successfully exported ${products.length} products`);
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