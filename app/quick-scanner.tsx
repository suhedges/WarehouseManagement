import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/Button';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { ArrowLeft, X } from 'lucide-react-native';

export default function QuickScannerScreen() {
  const { warehouseId } = useLocalSearchParams<{ warehouseId: string }>();
  const router = useRouter();
  const { findProductByBarcode, getWarehouse } = useWarehouse();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedData, setScannedData] = useState<string>('');
  
  const warehouse = getWarehouse(warehouseId);

  useEffect(() => {
    if (!warehouse) {
      Alert.alert('Error', 'Warehouse not found');
      router.back();
    }
  }, [warehouse, router]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    
    console.log('Barcode scanned:', data);
    setIsScanning(false);
    setScannedData(data);
    
    const product = findProductByBarcode(warehouseId, data);
    
    if (product) {
      Alert.alert(
        'Product Found',
        `Found: ${product.internalName}\nLocation: ${product.location}`,
        [
          {
            text: 'View Details',
            onPress: () => {
              router.replace(`/product/${product.id}`);
            }
          },
          {
            text: 'Scan Another',
            onPress: () => {
              setIsScanning(true);
              setScannedData('');
            }
          }
        ]
      );
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
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: [
              'aztec', 'ean13', 'ean8', 'qr', 'pdf417', 'upc_e', 'datamatrix',
              'code39', 'code93', 'itf14', 'codabar', 'code128', 'upc_a'
            ],
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
              <Text style={styles.instructionText}>
                Point camera at barcode to find product
              </Text>
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
});