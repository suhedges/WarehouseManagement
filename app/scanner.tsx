import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { X, ZoomIn, ZoomOut, Flashlight, FlashlightOff } from 'lucide-react-native';


const FRAME_SIZE = 260;

const BARCODE_TYPES = [
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
] as const;

export default function BarcodeScanner() {
  const params = useLocalSearchParams<{ productId: string; isNew: string; warehouseId?: string }>();
  const router = useRouter();
  const { getProduct } = useWarehouse();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Start at 0 to keep preview FPS high on more devices
  const [zoom, setZoom] = useState(0);
  const [torchOn, setTorchOn] = useState(false);

  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState('');


  const isNewProduct = params.isNew === 'true';
  const product = params.productId && !isNewProduct ? getProduct(params.productId) : null;

  const frameLeft = Math.max(0, (screenW - FRAME_SIZE) / 2);
  const frameTop = Math.max(0, (screenH - FRAME_SIZE) / 2);

  // --- Permissions (single path) ---
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      if (permission.canAskAgain) {
        requestPermission().catch(() => {});
      } else {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to scan barcodes. Enable it in Settings.'
        );
      }
    }
  }, [permission, requestPermission]);


  useEffect(() => {
    if (permission?.granted && isScanning) {
      setIsReady(false);
      const t = setTimeout(() => setIsReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [permission?.granted, isScanning]);

  const handleScanEvent = useCallback(
    ({ type, data }: { type?: string; data?: string }) => {
      if (!isScanning || !isReady || !data) return;
      setIsScanning(false);
      setScanned(true);
      setBarcodeData(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      console.log(`Scanned [${type ?? 'unknown'}] ${data}`);

    },
    [isScanning, isReady]
  );

  const handleConfirm = useCallback(() => {
    if (!barcodeData) return router.back();
    try {
      if (isNewProduct) {
        router.replace({
          pathname: '/product/[id]',
          params: { id: params.productId, warehouseId: params.warehouseId, scannedBarcode: barcodeData },
        });
      } else if (product) {
        router.replace({ pathname: '/product/[id]', params: { id: product.id, scannedBarcode: barcodeData } });
      } else {
        Alert.alert('Product Error', 'Product not found to update.');
      }
    } catch (e) {
      console.error('Confirm error', e);
      Alert.alert('Error', 'Failed to assign barcode.');
    }
  }, [barcodeData, isNewProduct, params.productId, params.warehouseId, product, router]);

  const handleCancel = useCallback(() => router.back(), [router]);

  const handleScanAgain = useCallback(() => {
    setScanned(false);
    setBarcodeData('');
    setIsScanning(true);
  }, []);

  // Torch toggle with Expo SDK 51 workaround (re-apply to “wake” torch)
  const toggleTorch = useCallback(() => {
    setTorchOn(prev => !prev);
  }, []);

  // --- Permission UI ---
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
        <Text style={styles.text}>We need your permission to use the camera.</Text>
        <Button title="Grant Permission" onPress={requestPermission} style={styles.button} />
        <Button title="Go Back" onPress={handleCancel} style={styles.button} />
      </SafeAreaView>
    );
  }

  const showFocusing = !isReady;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.scannerContainer} testID="scanner-container">
        {Platform.OS !== 'web' ? (
          <CameraView
            style={styles.scanner}
            facing="back"
            zoom={zoom}
            enableTorch={torchOn}
            onBarcodeScanned={scanned || !isReady ? undefined : handleScanEvent}
            barcodeScannerSettings={{
              barcodeTypes: BARCODE_TYPES as unknown as string[],
            }}
          />
        ) : (
          <View style={[styles.scanner, styles.webFallback]}>
            <Text style={styles.webFallbackText}>
              Camera scanning is not available on web. Please use the mobile app.
            </Text>
            <Button
              title="Enter Barcode Manually"
              onPress={() => {
                const barcode = prompt('Enter barcode manually:');
                if (barcode) handleScanEvent({ type: 'manual', data: barcode });
              }}
              style={styles.manualButton}
            />
          </View>
        )}

        {/* Scrim with a clear center cutout */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Top scrim */}
          <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: frameTop }]} />
          {/* Bottom scrim */}
          <View style={[styles.scrim, { left: 0, right: 0, top: frameTop + FRAME_SIZE, bottom: 0 }]} />
          {/* Left scrim */}
          <View style={[styles.scrim, { left: 0, top: frameTop, bottom: screenH - (frameTop + FRAME_SIZE), width: frameLeft }]} />
          {/* Right scrim */}
          <View style={[styles.scrim, { right: 0, top: frameTop, bottom: screenH - (frameTop + FRAME_SIZE), width: frameLeft }]} />
          {/* Visible frame */}
          <View
            style={[
              styles.scannerFrame,
              { width: FRAME_SIZE, height: FRAME_SIZE, left: frameLeft, top: frameTop },
            ]}
          />
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
                <Button title="Scan Again" onPress={handleScanAgain} variant="outline" style={styles.resultButton} />
                <Button title="Confirm" onPress={handleConfirm} style={styles.resultButton} />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Controls / Footer */}
      <View style={styles.footer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            testID="torch-toggle"
            style={[styles.controlButton, torchOn && styles.controlActive]}
            onPress={toggleTorch}
          >
            {torchOn ? <Flashlight size={22} color="#fff" /> : <FlashlightOff size={22} color="#000" />}
            <Text style={[styles.controlLabel, torchOn && styles.controlLabelActive]}>
              {torchOn ? 'Torch On' : 'Torch Off'}
            </Text>
          </TouchableOpacity>

          {showFocusing && (
            <Text style={styles.controlLabel} testID="focus-delay-indicator">Focusing…</Text>
          )}

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
  container: { flex: 1, backgroundColor: '#000' },
  scannerContainer: { flex: 1, position: 'relative' },
  scanner: { ...StyleSheet.absoluteFillObject },

  // Dims *outside* the frame only
  scrim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.45)', // slightly lighter to improve perceived FPS
  },

  scannerFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },

  productInfo: {
    position: 'absolute', top: 50, left: 0, right: 0,
    padding: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center',
  },
  productName: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  productLocation: { color: colors.gray[300], fontSize: 16, textAlign: 'center' },

  resultContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 24,
  },
  resultCard: { backgroundColor: colors.card, borderRadius: 8, padding: 24, width: '100%', alignItems: 'center' },
  resultTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  barcodeData: {
    fontSize: 18, marginBottom: 24, padding: 12,
    backgroundColor: colors.gray[100], borderRadius: 4, width: '100%', textAlign: 'center', color: '#000',
  },
  resultButtons: { flexDirection: 'row', width: '100%' },
  resultButton: { flex: 1, marginHorizontal: 4 },

  footer: { padding: 16, backgroundColor: colors.card },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlButton: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8 as unknown as number,
    backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, marginRight: 8,
  },
  controlActive: { backgroundColor: colors.primary },
  controlLabel: { color: '#000', fontSize: 14, marginLeft: 6 },
  controlLabelActive: { color: '#fff' },
  cancelButton: {
    marginLeft: 'auto', width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center',
  },

  text: { color: 'white', fontSize: 16, textAlign: 'center', margin: 24 },
  button: { marginTop: 16 },

  webFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gray[800] },
  webFallbackText: { color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 },
  manualButton: { marginTop: 16 },
});
