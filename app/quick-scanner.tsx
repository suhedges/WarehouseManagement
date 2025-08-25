import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/Button';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { ArrowLeft, X, Plus, Minus } from 'lucide-react-native';
import { Product } from '@/types';

export default function QuickScannerScreen() {
  const { warehouseId } = useLocalSearchParams<{ warehouseId: string }>();
  const router = useRouter();
  const { findProductByBarcode, getWarehouse, updateProduct } = useWarehouse();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedData, setScannedData] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  
  const warehouse = getWarehouse(warehouseId);
  
  const barcodeTypes = warehouse?.qrOnly
    ? ['qr']
    : [
        'aztec',
        'ean13',
        'ean8',
        'qr',
        'pdf417',
        'upc_e',
        'datamatrix',
        'code39',
        'code93',
        'itf14',
        'codabar',
        'code128',
        'upc_a',
      ];
  const instruction = warehouse?.qrOnly
    ? 'Point camera at QR code to find product'
    : 'Point camera at barcode to find product';

  useEffect(() => {
    if (!warehouse) {
      Alert.alert('Error', 'Warehouse not found');
      router.back();
    }
  }, [warehouse, router]);

  useEffect(() => {
    if (permission?.granted && isScanning) {
      setIsReady(false);
      const t = setTimeout(() => setIsReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [permission?.granted, isScanning]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning || !isReady) return;
    
    console.log('Barcode scanned:', data);
    setIsScanning(false);
    setScannedData(data);
    
    const product = findProductByBarcode(warehouseId, data);
    
    if (product) {
      setFoundProduct(product);
      setQuantity(product.quantity);
    } else {
      Alert.alert(
        'Product Not Found',
        `No product found with barcode: ${data}`,
        [
          {
            text: 'Scan Another',
            onPress: () => {
              setIsScanning(true);
              setScannedData('');
            }
          },
          {
            text: 'Cancel',
            onPress: () => router.back()
          }
        ]
      );
    }
  };
  const handleSaveQuantity = () => {
    if (foundProduct) {
      updateProduct(foundProduct.id, { quantity });
    }
    handleScanAnother();
  };

  const handleScanAnother = () => {
    setFoundProduct(null);
    setIsScanning(true);
    setScannedData('');
  };  
  
  const handleViewDetails = () => {
    if (foundProduct) {
      const id = foundProduct.id;
      handleScanAnother();
      router.push(`/product/${id}`);
    }
  };  

  if (!permission) {
    return <LoadingIndicator message="Loading camera..." />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Quick Scanner</Text>
        </View>
        
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Camera permission is required to scan barcodes
          </Text>
          <Button
            title="Grant Permission"
            onPress={requestPermission}
            style={styles.permissionButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!warehouse) {
    return <LoadingIndicator message="Loading warehouse..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Quick Scanner</Text>
        <Text style={styles.subtitle}>{warehouse.name}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={isScanning && isReady ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes,
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
            
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>{instruction}</Text>
              {scannedData && (
                <Text style={styles.scannedText}>
                  Scanned: {scannedData}
                </Text>
              )}
            </View>
          </View>
        </CameraView>
      </View>

      <View style={styles.bottomContainer}>
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="outline"
          icon={<X size={18} color={colors.primary} />}
        />
      </View>
      {foundProduct && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Product Found</Text>
              <Text style={styles.modalProductName}>{foundProduct.internalName}</Text>
              <Text style={styles.modalLocation}>Location: {foundProduct.location}</Text>

              <View style={styles.quantityAdjuster}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => setQuantity(q => Math.max(0, q - 1))}
                >
                  <Minus size={20} color="white" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => setQuantity(q => q + 1)}
                >
                  <Plus size={20} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <View style={styles.modalButton}>
                  <Button title="Save" onPress={handleSaveQuantity} style={styles.fullWidthButton} />
                </View>
                <View style={styles.modalButton}>
                  <Button
                    title="Details"
                    variant="secondary"
                    onPress={handleViewDetails}
                    testID="view-details-button"
                    style={styles.fullWidthButton}
                  />
                </View>
                
                <View style={styles.modalButton}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={handleScanAnother}
                    style={styles.fullWidthButton}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.primary,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: colors.text,
  },
  permissionButton: {
    minWidth: 200,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 32,
  },
  scannedText: {
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    marginHorizontal: 32,
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: colors.card,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text,
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.text,
  },
  modalLocation: {
    fontSize: 14,
    marginBottom: 16,
    color: colors.text,
  },
  quantityAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  adjustButton: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    padding: 8,
  },
  quantityText: {
    fontSize: 18,
    marginHorizontal: 16,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },  
  fullWidthButton: {
    width: '100%',
  },
});