import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SyncStatus } from '@/components/SyncStatus';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { formatNumber } from '@/utils/helpers';
import { 
  ArrowLeft, 
  Plus, 
  Package, 
  Barcode, 
  Upload, 
  Download, 
  AlertTriangle, 
  AlertCircle,
  Search
} from 'lucide-react-native';

export default function WarehouseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { 
    getWarehouse, 
    getWarehouseProducts, 
    isLoading, 
    syncStatus,
    getProductsWithoutBarcode,
    getProductsBelowMin,
    getProductsOverstock,
    deleteWarehouse
  } = useWarehouse();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const warehouse = getWarehouse(id);
  const products = getWarehouseProducts(id);
  const productsWithoutBarcode = getProductsWithoutBarcode(id);
  const productsBelowMin = getProductsBelowMin(id);
  const productsOverstock = getProductsOverstock(id);
  
  const filteredProducts = products.filter(product => 
    product.internalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!warehouse && !isLoading) {
      Alert.alert('Error', 'Warehouse not found');
      router.back();
    }
  }, [warehouse, isLoading, router]);

  const handleDeleteWarehouse = () => {
    Alert.alert(
      'Delete Warehouse',
      `Are you sure you want to delete "${warehouse?.name}"? This will delete all products in this warehouse and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWarehouse(id);
            router.replace('/warehouses');
          },
        },
      ]
    );
  };

  const handleMassBarcodeScanning = () => {
    if (productsWithoutBarcode.length === 0) {
      Alert.alert('No Products', 'There are no products without barcodes');
      return;
    }
    
    router.push({
      pathname: '/mass-scanner',
      params: { warehouseId: id }
    });
  };

  if (isLoading || !warehouse) {
    return <LoadingIndicator message="Loading warehouse..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{warehouse.name}</Text>
          <View style={styles.headerRight}>
            <SyncStatus status={syncStatus} />
          </View>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatNumber(products.length)}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, productsBelowMin.length > 0 ? styles.warningText : {}]}>
            {formatNumber(productsBelowMin.length)}
          </Text>
          <Text style={styles.statLabel}>Below Min</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, productsOverstock.length > 0 ? styles.infoText : {}]}>
            {formatNumber(productsOverstock.length)}
          </Text>
          <Text style={styles.statLabel}>Overstock</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <View style={styles.actionRow}>
          <Button
            title="Add Product"
            onPress={() => router.push({
              pathname: '/product/[id]',
              params: { id: 'new', warehouseId: id }
            })}
            icon={<Plus size={18} color="white" />}
            style={styles.actionButton}
          />
          <Button
            title="Mass Barcode"
            onPress={handleMassBarcodeScanning}
            icon={<Barcode size={18} color="white" />}
            variant="secondary"
            style={styles.actionButton}
            disabled={productsWithoutBarcode.length === 0}
          />
        </View>
        <View style={styles.actionRow}>
          <Button
            title="Import CSV"
            onPress={() => router.push({
              pathname: '/import',
              params: { warehouseId: id }
            })}
            icon={<Upload size={18} color={colors.primary} />}
            variant="outline"
            style={styles.actionButton}
          />
          <Button
            title="Export"
            onPress={() => router.push({
              pathname: '/export',
              params: { warehouseId: id }
            })}
            icon={<Download size={18} color={colors.primary} />}
            variant="outline"
            style={styles.actionButton}
          />
        </View>
      </View>

      {showSearch ? (
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            containerStyle={styles.searchInput}
          />
          <Button
            title="Cancel"
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            variant="outline"
            style={styles.cancelSearchButton}
          />
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={() => setShowSearch(true)}
        >
          <Search size={20} color={colors.gray[500]} />
          <Text style={styles.searchButtonText}>Search products...</Text>
        </TouchableOpacity>
      )}

      {products.length === 0 ? (
        <EmptyState
          title="No Products"
          description="Add your first product to start managing inventory"
          buttonTitle="Add Product"
          onButtonPress={() => router.push({
            pathname: '/product/[id]',
            params: { id: 'new', warehouseId: id }
          })}
          icon={<Package size={48} color={colors.gray[400]} />}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/product/${item.id}`)}
              testID={`product-${item.id}`}
            >
              <Card>
                <View style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.internalName}</Text>
                    <Text style={styles.productLocation}>Location: {item.location}</Text>
                    <Text style={styles.productBarcode}>
                      {item.barcode ? `Barcode: ${item.barcode}` : 'No barcode assigned'}
                    </Text>
                  </View>
                  <View style={styles.productQuantity}>
                    <Text style={[
                      styles.quantityValue,
                      item.quantity < item.minAmount ? styles.belowMinQuantity : 
                      item.quantity > item.maxAmount ? styles.aboveMaxQuantity : {}
                    ]}>
                      {formatNumber(item.quantity)}
                    </Text>
                    <Text style={styles.quantityLabel}>
                      Min: {item.minAmount} | Max: {item.maxAmount}
                    </Text>
                    {item.quantity < item.minAmount && (
                      <AlertTriangle size={16} color={colors.warning} style={styles.quantityIcon} />
                    )}
                    {item.quantity > item.maxAmount && (
                      <AlertCircle size={16} color={colors.primary} style={styles.quantityIcon} />
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <Button
          title="Delete Warehouse"
          onPress={handleDeleteWarehouse}
          variant="danger"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  warningText: {
    color: colors.warning,
  },
  infoText: {
    color: colors.primary,
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
  },
  cancelSearchButton: {
    height: 48,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    margin: 16,
  },
  searchButtonText: {
    marginLeft: 8,
    color: colors.gray[500],
    fontSize: 16,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productLocation: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 14,
    color: colors.gray[500],
  },
  productQuantity: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityLabel: {
    fontSize: 12,
    color: colors.gray[500],
  },
  quantityIcon: {
    marginTop: 4,
  },
  belowMinQuantity: {
    color: colors.warning,
  },
  aboveMaxQuantity: {
    color: colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});