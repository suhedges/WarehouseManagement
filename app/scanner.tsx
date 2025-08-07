import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { X } from 'lucide-react-native';

export default function BarcodeScanner() {
  const params = useLocalSearchParams<{ productId: string; isNew: string }>();
  const router = useRouter();
  const { getProduct, updateProduct } = useWarehouse();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState('');
  
  const product = params.productId ? getProduct(params.productId) : null;


  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setBarcodeData(data);
    console.log(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  const handleConfirm = () => {
    if (product && barcodeData) {
      updateProduct(product.id, { barcode: barcodeData });
    }
    router.back();
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
      
      {!scanned && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <X size={24} color="white" />
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