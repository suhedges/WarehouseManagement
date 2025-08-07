import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { X, ArrowRight } from 'lucide-react-native';

export default function MassBarcodeScanner() {
  const params = useLocalSearchParams<{ warehouseId: string }>();
  const router = useRouter();
  const { getProductsWithoutBarcode, updateProduct } = useWarehouse();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const productsWithoutBarcode = getProductsWithoutBarcode(params.warehouseId);
  const currentProduct = productsWithoutBarcode[currentIndex];
  const isLastProduct = currentIndex === productsWithoutBarcode.length - 1;

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  useEffect(() => {
    if (productsWithoutBarcode.length === 0) {
      router.back();
    }
  }, [productsWithoutBarcode, router]);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setBarcodeData(data);
    console.log(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  const handleConfirm = () => {
    if (currentProduct && barcodeData) {
      updateProduct(currentProduct.id, { barcode: barcodeData });
      
      if (isLastProduct) {
        router.back();
      } else {
        setCurrentIndex(currentIndex + 1);
        setScanned(false);
        setBarcodeData('');
      }
    }
  };

  const handleSkip = () => {
    if (isLastProduct) {
      router.back();
    } else {
      setCurrentIndex(currentIndex + 1);
      setScanned(false);
      setBarcodeData('');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleScanAgain = () => {
    setScanned(false);
    setBarcodeData('');
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <Button title="Go Back" onPress={handleCancel} style={styles.button} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
        
        <View style={styles.overlay}>
          <View style={styles.scannerFrame} />
        </View>
        
        {currentProduct && !scanned && (
          <View style={styles.productInfo}>
            <Text style={styles.productCount}>
              Product {currentIndex + 1} of {productsWithoutBarcode.length}
            </Text>
            <Text style={styles.productName}>{currentProduct.internalName}</Text>
            <Text style={styles.productLocation}>Location: {currentProduct.location}</Text>
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
                  title={isLastProduct ? "Confirm & Finish" : "Confirm & Next"}
                  onPress={handleConfirm}
                  style={styles.resultButton}
                />
              </View>
            </View>
          </View>
        )}
      </View>
      
      {!scanned && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <X size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <ArrowRight size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}
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
  productCount: {
    color: colors.gray[300],
    fontSize: 14,
    marginBottom: 8,
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
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
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
});