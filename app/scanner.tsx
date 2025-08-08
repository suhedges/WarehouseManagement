import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { X, ZoomIn, ZoomOut } from 'lucide-react-native';

export default function BarcodeScanner() {
  const params = useLocalSearchParams<{ productId: string; isNew: string; warehouseId?: string }>();
  const router = useRouter();
  const { getProduct, updateProduct } = useWarehouse();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [barcodeData, setBarcodeData] = useState<string>('');

  const [zoom, setZoom] = useState<number>(0);
  
  const isNewProduct = params.isNew === 'true';
  const product = params.productId && !isNewProduct ? getProduct(params.productId) : null;
  
  console.log('Scanner params:', params);
  console.log('Is new product:', isNewProduct);
  console.log('Product found:', product);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(({ type, data }: { type: string; data: string }) => {
    if (scanned) return; // Prevent multiple scans
    
    try {
      setScanned(true);
      setBarcodeData(data);
      console.log(`Bar code with type ${type} and data ${data} has been scanned!`);
    } catch (e) {
      console.error('Error handling scanned barcode', e);
      Alert.alert('Scan Error', 'There was a problem processing the scanned barcode. Please try again.');
      setScanned(false);
      setBarcodeData('');
    }
  }, [scanned]);

  const handleConfirm = () => {
    if (barcodeData) {
      try {
        if (isNewProduct) {
          router.replace({
            pathname: '/product/[id]',
            params: {
              id: params.productId,
              warehouseId: params.warehouseId,
              scannedBarcode: barcodeData,
            },
          });
        } else if (product) {
          router.replace({
            pathname: '/product/[id]',
            params: {
              id: product.id,
              scannedBarcode: barcodeData,
            },
          });
        } else {
          Alert.alert('Product Error', 'Product not found to update.');
        }
      } catch (e) {
        console.error('Confirm scan error', e);
        Alert.alert('Error', 'Failed to assign barcode.');
      }
    } else {
      router.back();
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleScanAgain = () => {
    setScanned(false);
    setBarcodeData('');
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} style={styles.button} />
        <Button title="Go Back" onPress={handleCancel} style={styles.button} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.scannerContainer} testID="scanner-container">
        {Platform.OS !== 'web' ? (
          <CameraView
            style={styles.scanner}
            facing={'back' as CameraType}
            zoom={zoom}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: [
                'code128',
                'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'itf14', 'codabar',
                'qr', 'pdf417', 'aztec', 'datamatrix'
              ],
            }}
          />
        ) : (
          <View style={[styles.scanner, styles.webFallback]}>
            <Text style={styles.webFallbackText}>
              Camera scanning is not available on web.
              Please use the mobile app to scan barcodes.
            </Text>
            <Button
              title="Enter Barcode Manually"
              onPress={() => {
                const barcode = prompt('Enter barcode manually:');
                if (barcode) {
                  handleBarCodeScanned({ type: 'manual', data: barcode });
                }
              }}
              style={styles.manualButton}
            />
          </View>
        )}
        
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scannerFrame} />
        </View>
        
        {product && !scanned && (
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.internalName}</Text>
            <Text style={styles.productLocation}>Location: {product.location}</Text>
          </View>
        )}
        
        {scanned && (
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Barcode Detected</Text>
              <Text style={styles.barcodeData}>{barcodeData}</Text>
              
              <View style={styles.resultButtons}>
                <Button
                  title="Scan Again"
                  onPress={handleScanAgain}
                  variant="outline"
                  style={styles.resultButton}
                />
                <Button
                  title="Confirm"
                  onPress={handleConfirm}
                  style={styles.resultButton}
                />
              </View>
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            testID="torch-toggle"
            style={[styles.controlButton]}
            disabled
          >
            <Text style={styles.controlLabel}>Lighting Tips: avoid glare</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            testID="zoom-out"
            style={styles.controlButton}
            onPress={() => setZoom(z => Math.max(0, Number((z - 0.1).toFixed(2))))}
          >
            <ZoomOut size={22} color="#000" />
            <Text style={styles.controlLabel}>Zoom -</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            testID="zoom-in"
            style={styles.controlButton}
            onPress={() => setZoom(z => Math.min(1, Number((z + 0.1).toFixed(2))))}
          >
            <ZoomIn size={22} color="#000" />
            <Text style={styles.controlLabel}>Zoom +</Text>
          </TouchableOpacity>

          {!scanned && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} testID="cancel-scan">
              <X size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  productInfo: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
  },
  productName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  productLocation: {
    color: colors.gray[300],
    fontSize: 16,
    textAlign: 'center',
  },
  resultContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 24,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  barcodeData: {
    fontSize: 18,
    marginBottom: 24,
    padding: 12,
    backgroundColor: colors.gray[100],
    borderRadius: 4,
    width: '100%',
    textAlign: 'center',
  },
  resultButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  resultButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.card,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 as unknown as number,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  controlActive: {
    backgroundColor: colors.primary,
  },
  controlLabel: {
    color: '#000',
    fontSize: 14,
    marginLeft: 6,
  },
  controlLabelActive: {
    color: '#fff',
  },
  cancelButton: {
    marginLeft: 'auto',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
  button: {
    marginTop: 16,
  },
  webFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[800],
  },
  webFallbackText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  manualButton: {
    marginTop: 16,
  },
});