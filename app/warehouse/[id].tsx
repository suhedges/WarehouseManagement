// app/warehouse/[id].tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExpandableCard } from '@/components/ExpandableCard';
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
  Search,
  Settings,
  ScanLine,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Eye,
  EyeOff,
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
    updateWarehouse,
  } = useWarehouse();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'location' | 'belowMin' | 'belowMax' | 'overstock'>('all');
  const [sortBy, setSortBy] = useState<'location' | 'internalName' | 'customerName'>('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [showDashboard, setShowDashboard] = useState(true); // 👈 eyeball toggle

  const warehouse = getWarehouse(id);
  const products = getWarehouseProducts(id);
  const productsWithoutBarcode = getProductsWithoutBarcode(id);
  const productsBelowMin = getProductsBelowMin(id);
  const productsOverstock = getProductsOverstock(id);

  const getFilteredProducts = () => {
    let filtered = products;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((product) =>
        product.internalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (activeFilter) {
      case 'location':
        if (locationFilter) {
          filtered = filtered.filter((product) =>
            product.location.toLowerCase().includes(locationFilter.toLowerCase())
          );
        }
        break;
      case 'belowMin':
        filtered = filtered.filter((product) => product.quantity < product.minAmount);
        break;
      case 'belowMax':
        filtered = filtered.filter((product) => product.quantity < product.maxAmount);
        break;
      case 'overstock':
        filtered = filtered.filter((product) => product.quantity > product.maxAmount);
        break;
      default:
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortBy) {
        case 'internalName':
          aValue = a.internalName.toLowerCase();
          bValue = b.internalName.toLowerCase();
          break;
        case 'customerName':
          aValue = a.customerName.toLowerCase();
          bValue = b.customerName.toLowerCase();
          break;
        case 'location':
        default:
          aValue = a.location.toLowerCase();
          bValue = b.location.toLowerCase();
          break;
      }

      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  useEffect(() => {
    if (!warehouse && !isLoading) {
      Alert.alert('Error', 'Warehouse not found');
      router.back();
    }
  }, [warehouse, isLoading, router]);

  const handleMassBarcodeScanning = () => {
    if (productsWithoutBarcode.length === 0) {
      Alert.alert('No Products', 'There are no products without barcodes');
      return;
    }

    router.push({
      pathname: '/mass-scanner',
      params: { warehouseId: id },
    });
  };

  // Stat click handlers
  const handleClearAllFilters = () => {
    setActiveFilter('all');
    setLocationFilter('');
    setSearchQuery('');
  };
  const handleFilterBelowMin = () => {
    setActiveFilter('belowMin');
    setLocationFilter('');
  };
  const handleFilterOverstock = () => {
    setActiveFilter('overstock');
    setLocationFilter('');
  };

  if (isLoading || !warehouse) {
    return <LoadingIndicator message="Loading warehouse..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{warehouse.name}</Text>
          <View style={styles.headerRight}>
            {/* 👁️ Eyeball toggle (left of settings) */}
            <TouchableOpacity
              onPress={() => setShowDashboard((prev) => !prev)}
              style={styles.eyeButton}
              accessibilityLabel={showDashboard ? 'Hide dashboard panels' : 'Show dashboard panels'}
              testID="toggle-dashboard"
            >
              {showDashboard ? (
                <Eye size={20} color={colors.text} />
              ) : (
                <EyeOff size={20} color={colors.text} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push(`/warehouse-settings/${id}`)}
              style={styles.settingsButton}
            >
              <Settings size={20} color={colors.text} />
            </TouchableOpacity>
            <SyncStatus status={syncStatus} />
          </View>
        </View>
      </View>

      {/* Stats – now clickable, and can be hidden via eyeball */}
      {showDashboard && (
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard} onPress={handleClearAllFilters} testID="stat-products">
            <Text style={styles.statValue}>{formatNumber(products.length)}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={handleFilterBelowMin} testID="stat-below-min">
            <Text style={[styles.statValue, productsBelowMin.length > 0 ? styles.warningText : {}]}>
              {formatNumber(productsBelowMin.length)}
            </Text>
            <Text style={styles.statLabel}>Below Min</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={handleFilterOverstock} testID="stat-overstock">
            <Text style={[styles.statValue, productsOverstock.length > 0 ? styles.infoText : {}]}>
              {formatNumber(productsOverstock.length)}
            </Text>
            <Text style={styles.statLabel}>Overstock</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.qrToggleRow}>
        <Text style={styles.qrToggleText}>QR</Text>
        <Switch
          value={!!warehouse?.qrOnly}
          onValueChange={(value) => updateWarehouse(id, { qrOnly: value })}
        />
      </View>

      {/* Actions – collapsible card, also hidden via eyeball */}
      {showDashboard && (
        <ExpandableCard title="Actions">
          <View style={styles.actionRow}>
            <Button
              title="Add Product"
              onPress={() =>
                router.push({
                  pathname: '/product/[id]',
                  params: { id: 'new', warehouseId: id },
                })
              }
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
              onPress={() =>
                router.push({
                  pathname: '/import',
                  params: { warehouseId: id },
                })
              }
              icon={<Upload size={18} color={colors.primary} />}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              title="Export"
              onPress={() =>
                router.push({
                  pathname: '/export',
                  params: { warehouseId: id },
                })
              }
              icon={<Download size={18} color={colors.primary} />}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        </ExpandableCard>
      )}

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
        <TouchableOpacity style={styles.searchButton} onPress={() => setShowSearch(true)}>
          <Search size={20} color={colors.gray[500]} />
          <Text style={styles.searchButtonText}>Search products...</Text>
        </TouchableOpacity>
      )}

      {/* Filter and Sort Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setShowFilters(!showFilters)}>
            <Filter size={16} color={colors.primary} />
            <Text style={styles.controlButtonText}>Filter</Text>
            <ChevronDown
              size={16}
              color={colors.primary}
              style={[styles.chevron, showFilters && styles.chevronRotated]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown size={16} color={colors.primary} />
            <Text style={styles.controlButtonText}>
              Sort: {sortBy === 'location' ? 'Location' : sortBy === 'internalName' ? 'Internal' : 'Customer'} (
              {sortOrder.toUpperCase()})
            </Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('all');
                  setLocationFilter('');
                }}
              >
                <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'belowMin' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('belowMin');
                  setLocationFilter('');
                }}
              >
                <Text style={[styles.filterChipText, activeFilter === 'belowMin' && styles.filterChipTextActive]}>
                  Below Min
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'belowMax' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('belowMax');
                  setLocationFilter('');
                }}
              >
                <Text style={[styles.filterChipText, activeFilter === 'belowMax' && styles.filterChipTextActive]}>
                  Below Max
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'overstock' && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter('overstock');
                  setLocationFilter('');
                }}
              >
                <Text style={[styles.filterChipText, activeFilter === 'overstock' && styles.filterChipTextActive]}>
                  Overstock
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'location' && styles.filterChipActive]}
                onPress={() => setActiveFilter('location')}
              >
                <Text style={[styles.filterChipText, activeFilter === 'location' && styles.filterChipTextActive]}>
                  By Location
                </Text>
              </TouchableOpacity>
            </View>

            {activeFilter === 'location' && (
              <View style={styles.locationFilterContainer}>
                <Input
                  placeholder="Enter location to filter..."
                  value={locationFilter}
                  onChangeText={setLocationFilter}
                  containerStyle={styles.locationFilterInput}
                />
              </View>
            )}

            <View style={styles.sortContainer}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'location' && styles.sortChipActive]}
                  onPress={() => setSortBy('location')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'location' && styles.sortChipTextActive]}>Location</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'internalName' && styles.sortChipActive]}
                  onPress={() => setSortBy('internalName')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'internalName' && styles.sortChipTextActive]}>
                    Internal Name
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'customerName' && styles.sortChipActive]}
                  onPress={() => setSortBy('customerName')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'customerName' && styles.sortChipTextActive]}>
                    Customer Name
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {products.length === 0 ? (
        <EmptyState
          title="No Products"
          description="Add your first product to start managing inventory"
          buttonTitle="Add Product"
          onButtonPress={() =>
            router.push({
              pathname: '/product/[id]',
              params: { id: 'new', warehouseId: id },
            })
          }
          icon={<Package size={48} color={colors.gray[400]} />}
        />
      ) : filteredProducts.length === 0 && products.length > 0 ? (
        <EmptyState
          title="No Products Found"
          description="No products match your current filters"
          buttonTitle="Clear Filters"
          onButtonPress={() => {
            setActiveFilter('all');
            setLocationFilter('');
            setSearchQuery('');
          }}
          icon={<Package size={48} color={colors.gray[400]} />}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/product/${item.id}`)} testID={`product-${item.id}`}>
              <Card>
                <View style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.internalName}</Text>
                    <Text style={styles.productCustomerName}>Customer: {item.customerName}</Text>
                    <Text style={styles.productLocation}>Location: {item.location}</Text>
                    <Text style={styles.productBarcode}>
                      {item.barcode ? `Barcode: ${item.barcode}` : 'No barcode assigned'}
                    </Text>
                  </View>
                  <View style={styles.productQuantity}>
                    <Text
                      style={[
                        styles.quantityValue,
                        item.quantity < item.minAmount
                          ? styles.belowMinQuantity
                          : item.quantity > item.maxAmount
                          ? styles.aboveMaxQuantity
                          : {},
                      ]}
                    >
                      {formatNumber(item.quantity)}
                    </Text>
                    <Text style={styles.quantityLabel}>Min: {item.minAmount} | Max: {item.maxAmount}</Text>
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

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: '/quick-scanner',
            params: { warehouseId: id },
          })
        }
        testID="quick-scan-fab"
      >
        <ScanLine size={24} color="white" />
      </TouchableOpacity>
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
  eyeButton: {
    marginRight: 12,
    padding: 4,
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
  actionRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  qrToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  qrToggleText: {
    marginRight: 8,
    color: colors.text,
    fontSize: 16,
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
    paddingBottom: 32,
  },
  settingsButton: {
    marginRight: 12,
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  controlsContainer: {
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    marginHorizontal: 4,
  },
  controlButtonText: {
    marginLeft: 8,
    marginRight: 4,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  locationFilterContainer: {
    marginTop: 8,
  },
  locationFilterInput: {
    marginBottom: 0,
  },
  sortContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  sortChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  sortChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: 'white',
  },
  productCustomerName: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 2,
  },
});
