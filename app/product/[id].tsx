import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { ArrowLeft, Barcode, Save, Trash } from 'lucide-react-native';

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string; warehouseId?: string; scannedBarcode?: string }>();
  const router = useRouter();
  const { 
    getProduct, 
    getWarehouse,
    addProduct, 
    updateProduct, 
    deleteProduct, 
    isLoading,
    findProductByBarcode,
  } = useWarehouse();
  
  const isNewProduct = params.id === 'new';
  const product = isNewProduct ? null : getProduct(params.id);
  const warehouse = params.warehouseId ? getWarehouse(params.warehouseId) : 
                   product ? getWarehouse(product.warehouseId) : null;
  
  const [formData, setFormData] = useState({
    internalName: '',
    customerName: '',
    barcode: '',
    location: '',
    minAmount: '0',
    maxAmount: '0',
    quantity: '0',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isNewProduct && product) {
      setFormData({
        internalName: product.internalName,
        customerName: product.customerName,
        barcode: product.barcode,
        location: product.location,
        minAmount: product.minAmount.toString(),
        maxAmount: product.maxAmount.toString(),
        quantity: product.quantity.toString(),
      });
    }
  }, [product, isNewProduct]);

  useEffect(() => {
    if (!isNewProduct && !product && !isLoading) {
      Alert.alert('Error', 'Product not found');
      router.back();
    }
  }, [product, isLoading, isNewProduct, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.internalName.trim()) {
      newErrors.internalName = 'Internal name is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Product location is required';
    }
    
    // Validate numeric fields
    const minAmount = parseInt(formData.minAmount, 10);
    const maxAmount = parseInt(formData.maxAmount, 10);
    const quantity = parseInt(formData.quantity, 10);
    
    if (isNaN(minAmount) || minAmount < 0) {
      newErrors.minAmount = 'Min amount must be a positive number';
    }
    
    if (isNaN(maxAmount) || maxAmount < 0) {
      newErrors.maxAmount = 'Max amount must be a positive number';
    }
    
    if (isNaN(quantity) || quantity < 0) {
      newErrors.quantity = 'Quantity must be a positive number';
    }
    
    if (minAmount > maxAmount) {
      newErrors.minAmount = 'Min amount cannot be greater than max amount';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    
    const productData = {
      internalName: formData.internalName.trim(),
      customerName: formData.customerName.trim(),
      barcode: formData.barcode.trim(),
      location: formData.location.trim(),
      minAmount: parseInt(formData.minAmount, 10),
      maxAmount: parseInt(formData.maxAmount, 10),
      quantity: parseInt(formData.quantity, 10),
      warehouseId: isNewProduct ? params.warehouseId! : product!.warehouseId,
    };
    
    if (productData.barcode) {
      const existing = findProductByBarcode(productData.warehouseId, productData.barcode);
      if (existing && (!isNewProduct ? existing.id !== params.id : true)) {
        Alert.alert('Duplicate barcode', 'This barcode is already assigned to another product.');
        return;
      }
    }

    if (isNewProduct) {
      addProduct(productData);
      router.back();
    } else {
      updateProduct(params.id, productData);
      router.back();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProduct(params.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleScanBarcode = () => {
    router.push({
      pathname: '/scanner',
      params: { 
        productId: params.id, 
        isNew: isNewProduct ? 'true' : 'false',
        warehouseId: params.warehouseId 
      }
    });
  };
  
  // Apply scanned barcode only once to avoid update loops
  const appliedScannedRef = useRef<string | null>(null);
  useEffect(() => {
    const scanned = params.scannedBarcode;
    if (scanned && appliedScannedRef.current !== scanned) {
      console.log('Received scanned barcode:', scanned);
      setFormData(prev => ({ ...prev, barcode: scanned }));
      appliedScannedRef.current = scanned;
    }
  }, [params.scannedBarcode]);

  if (isLoading || (!isNewProduct && !product)) {
    return <LoadingIndicator message="Loading product..." />;
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
          <Text style={styles.title}>
            {isNewProduct ? 'Add Product' : 'Edit Product'}
          </Text>
        </View>
        {warehouse && (
          <Text style={styles.warehouseName}>Warehouse: {warehouse.name}</Text>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.scrollView}>
          <Card style={styles.formCard}>
            <Input
              label="Internal Product Name"
              placeholder="Enter internal name"
              value={formData.internalName}
              onChangeText={(text) => setFormData({ ...formData, internalName: text })}
              error={errors.internalName}
            />
            
            <Input
              label="Customer Product Name"
              placeholder="Enter customer name (optional)"
              value={formData.customerName}
              onChangeText={(text) => setFormData({ ...formData, customerName: text })}
            />
            
            <View style={styles.barcodeContainer}>
              <Input
                label="Barcode"
                placeholder="No barcode assigned"
                value={formData.barcode}
                onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                containerStyle={styles.barcodeInput}
                editable={true}
              />
              <Button
                title="Scan"
                onPress={handleScanBarcode}
                icon={<Barcode size={18} color="white" />}
                style={styles.scanButton}
              />
            </View>
            
            <Input
              label="Product Location"
              placeholder="Enter location (e.g., A1-B2)"
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              error={errors.location}
            />
            
            <View style={styles.row}>
              <Input
                label="Min Amount"
                placeholder="0"
                value={formData.minAmount}
                onChangeText={(text) => setFormData({ ...formData, minAmount: text })}
                keyboardType="numeric"
                containerStyle={styles.halfInput}
                error={errors.minAmount}
              />
              
              <Input
                label="Max Amount"
                placeholder="0"
                value={formData.maxAmount}
                onChangeText={(text) => setFormData({ ...formData, maxAmount: text })}
                keyboardType="numeric"
                containerStyle={styles.halfInput}
                error={errors.maxAmount}
              />
            </View>
            
            <Input
              label="Current Quantity"
              placeholder="0"
              value={formData.quantity}
              onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          {!isNewProduct && (
            <Button
              title="Delete"
              onPress={handleDelete}
              variant="danger"
              icon={<Trash size={18} color="white" />}
              style={styles.deleteButton}
            />
          )}
          <Button
            title="Save"
            onPress={handleSave}
            icon={<Save size={18} color="white" />}
            style={styles.saveButton}
          />
        </View>
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
  },
  warehouseName: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formCard: {
    margin: 16,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barcodeInput: {
    flex: 1,
    marginRight: 8,
  },
  scanButton: {
    height: 48,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  footer: {
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButtons: {
    flexDirection: 'row',
  },
  deleteButton: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    flex: 2,
  },
});