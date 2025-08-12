import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { parseCSV } from '@/utils/helpers';
import { Upload, X, FileText } from 'lucide-react-native';

const CSV_MIME_TYPES = [
  // Common/expected
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  // Often mislabeled as Excel by some Android file providers
  'application/vnd.ms-excel',
  'application/msexcel',
  'application/vnd.msexcel',
  // Frequently mislabeled as generic text/binary
  'text/plain',
  'application/octet-stream',
];

function isCsvFilename(name?: string) {
  if (!name) return false;
  // Allow .csv (case-insensitive) and common double-extensions like .csv.txt
  return /\.csv(\.[a-z0-9]+)?$/i.test(name.trim());
}

function isCsvMime(mime?: string) {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return CSV_MIME_TYPES.some(t => normalized === t || normalized.includes('csv'));
}

export default function ImportScreen() {
  const params = useLocalSearchParams<{ warehouseId: string }>();
  const router = useRouter();
  const { getWarehouse, importProducts } = useWarehouse();
  
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  const warehouse = getWarehouse(params.warehouseId);

  const handlePickDocument = async () => {
    try {
      // IMPORTANT: on Android use a plain string '*/*' (not ['*/*']) to truly allow all files.
      // We’ll validate name/MIME ourselves afterward.
      const pickerType: DocumentPicker.DocumentPickerOptions['type'] =
        Platform.OS === 'android'
          ? '*/*'
          : [
              // iOS/web: be permissive but prefer CSV/text
              'text/csv',
              'public.comma-separated-values-text', // iOS UTI
              'text/plain',
              'application/csv',
              '*/*', // final fallback so users can still pick oddly labeled CSVs
            ];

      const result = await DocumentPicker.getDocumentAsync({
        type: pickerType,
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      const pickedName = asset.name ?? '';
      const pickedMime = asset.mimeType ?? '';

      // Basic validation: name or mime should indicate CSV; allow override with a warning.
      if (!isCsvFilename(pickedName) && !isCsvMime(pickedMime)) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'File May Not Be CSV',
            `The selected file "${pickedName || 'Unnamed file'}" doesn't look like a CSV.\n\nContinue anyway?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', style: 'default', onPress: () => resolve(true) },
            ]
          );
        });
        if (!proceed) return;
      }

      setFileName(pickedName || 'selected.csv');

      // Read contents
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = (e.target?.result as string) ?? '';
            handleCsvContent(content);
          };
          reader.onerror = () => Alert.alert('Error', 'Failed to read CSV file');
          reader.readAsText(blob);
        } catch (e) {
          console.error('Web read error:', e);
          Alert.alert('Error', 'Failed to read CSV file');
        }
      } else {
        // Native (Android/iOS)
        try {
          // Prefer UTF-8; most CSVs from spreadsheets/exporters use it.
          // If you expect other encodings, consider detecting BOM or handling on backend.
          const content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          handleCsvContent(content);
        } catch (e) {
          console.error('Mobile read error:', e);
          Alert.alert('Error', 'Failed to read CSV file');
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleCsvContent = (content: string) => {
    setCsvContent(content);
    try {
      const parsed = parseCSV(content);
      if (!Array.isArray(parsed)) throw new Error('Parse returned non-array');
      setPreviewData(parsed.slice(0, 5)); // Preview first 5 rows
    } catch (e) {
      console.error('Parse error:', e);
      setPreviewData([]);
      Alert.alert('Error', 'Failed to parse CSV file');
    }
  };

  const handleImport = () => {
    if (!csvContent) {
      Alert.alert('Error', 'Please select a CSV file first');
      return;
    }
    
    try {
      setIsLoading(true);
      const parsedData = parseCSV(csvContent);
      
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        Alert.alert('Error', 'No data found in CSV file');
        setIsLoading(false);
        return;
      }
      
      // Validate required fields
      const missingFields: string[] = [];
      if (!Object.prototype.hasOwnProperty.call(parsedData[0], 'internalName')) missingFields.push('internalName');
      if (!Object.prototype.hasOwnProperty.call(parsedData[0], 'location')) missingFields.push('location');
      
      if (missingFields.length > 0) {
        Alert.alert('Error', `CSV is missing required fields: ${missingFields.join(', ')}`);
        setIsLoading(false);
        return;
      }
      
      const importedProducts = importProducts(params.warehouseId, parsedData);
      
      Alert.alert(
        'Import Successful',
        `Successfully imported ${importedProducts.length} products`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import products');
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
          <Text style={styles.title}>Import Products from CSV</Text>
          {warehouse && (
            <Text style={styles.warehouseName}>Warehouse: {warehouse.name}</Text>
          )}
          
          <Text style={styles.description}>
            Upload a CSV file with the following columns: internalName, customerName, barcode, location, minAmount, maxAmount, quantity
          </Text>
          
          <Button
            title={fileName ? 'Change File' : 'Select CSV File'}
            onPress={handlePickDocument}
            icon={<Upload size={18} color={colors.primary} />}
            variant="outline"
            style={styles.uploadButton}
          />
          
          {fileName && (
            <View style={styles.fileInfo}>
              <FileText size={20} color={colors.primary} />
              <Text style={styles.fileName}>{fileName}</Text>
            </View>
          )}
          
          {previewData.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewTitle}>Preview (first 5 rows):</Text>
              <ScrollView horizontal style={styles.previewTable}>
                <View>
                  {/* Header row */}
                  <View style={styles.previewRow}>
                    {Object.keys(previewData[0]).map((key) => (
                      <Text key={key} style={styles.previewHeader}>{key}</Text>
                    ))}
                  </View>
                  
                  {/* Data rows */}
                  {previewData.map((row, index) => (
                    <View key={index} style={styles.previewRow}>
                      {Object.values(row).map((value, i) => (
                        <Text key={i} style={styles.previewCell}>
                          {value?.toString() || ''}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={handleCancel}
              variant="outline"
              icon={<X size={18} color={colors.primary} />}
              style={styles.cancelButton}
            />
            <Button
              title="Import"
              onPress={handleImport}
              loading={isLoading}
              disabled={!csvContent || isLoading}
              icon={<Upload size={18} color="white" />}
              style={styles.importButton}
            />
          </View>
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
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 24,
    lineHeight: 20,
  },
  uploadButton: {
    marginBottom: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    marginBottom: 24,
  },
  fileName: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  previewContainer: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewTable: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
  },
  previewRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  previewHeader: {
    fontWeight: 'bold',
    padding: 8,
    minWidth: 100,
    backgroundColor: colors.gray[100],
  },
  previewCell: {
    padding: 8,
    minWidth: 100,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    marginRight: 8,
  },
  importButton: {
    minWidth: 120,
  },
});
