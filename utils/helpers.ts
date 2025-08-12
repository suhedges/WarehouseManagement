// utils/helpers.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share as RNShare } from 'react-native';
import { Product } from '@/types';

/**
 * Persisted key for Android Storage Access Framework (SAF) directory URI.
 * We cache the user's chosen folder (e.g., Downloads) so we don't ask every time.
 */
const CSV_DIR_KEY = 'CSV_DIR_URI';

/** Generate a random id */
export const generateId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

/** Format a number with locale separators */
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

/**
 * Very simple CSV parser (expects unescaped commas).
 * Keeps behavior of your original helper, but supports CRLF line endings.
 */
export const parseCSV = (csvString: string): any[] => {
  const lines = csvString.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(header => header.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const obj: Record<string, any> = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? '';

      // Convert numeric values (match your original behavior)
      if (['minAmount', 'maxAmount', 'quantity'].includes(header)) {
        obj[header] = parseInt(value, 10) || 0;
      } else {
        obj[header] = value;
      }
    });

    return obj;
  });
};

/** Escape a single CSV cell value according to RFC 4180-ish rules */
const escapeCSV = (v: any): string => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // normalize internal newlines to spaces for safety
  s = s.replace(/\r?\n/g, ' ');
  const needsQuotes = /[",\n]/.test(s) || /^\s|\s$/.test(s);
  s = s.replace(/"/g, '""');
  return needsQuotes ? `"${s}"` : s;
};

/**
 * Generate CSV for a fixed set of product columns
 * (preserves your original columns + quoting improvements).
 * Uses CRLF line endings for better Excel compatibility.
 */
export const generateCSV = (products: Product[]): string => {
  const headers = [
    'internalName',
    'customerName',
    'barcode',
    'location',
    'minAmount',
    'maxAmount',
    'quantity',
  ];

  const headerRow = headers.join(',');

  const rows = products.map(product =>
    headers
      .map(header => {
        const value = (product as any)[header];
        return escapeCSV(value);
      })
      .join(',')
  );

  return [headerRow, ...rows].join('\r\n');
};

/**
 * Export CSV:
 * - Web: triggers a normal file download via Blob + <a download>.
 * - Android: prefers SAF (user picks a folder like Downloads). We cache the folder permission.
 *            Fallback to share sheet if SAF not granted.
 * - iOS: writes to cacheDirectory and opens the share sheet.
 *
 * Returns true on success (or best-effort fallback), false on hard failure.
 */
export const exportCSV = async (data: Product[], filename: string): Promise<boolean> => {
  try {
    // Prepend BOM so Excel opens UTF-8 correctly. Use CRLF endings from generateCSV.
    const csvBody = generateCSV(data);
    const csvContent = '\uFEFF' + csvBody;

    if (Platform.OS === 'web') {
      // Web download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      return true;
    }

    // Native platforms
    if (Platform.OS === 'android') {
      // Try a previously approved directory via SAF
      const savedDir = await AsyncStorage.getItem(CSV_DIR_KEY);
      if (savedDir) {
        try {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            savedDir,
            filename,
            'text/csv'
          );
          await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return true;
        } catch (e) {
          // The cached permission may have been revoked or the folder deleted
          await AsyncStorage.removeItem(CSV_DIR_KEY);
        }
      }

      // Ask the user to pick a directory (recommend Downloads)
      try {
        const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted && perm.directoryUri) {
          await AsyncStorage.setItem(CSV_DIR_KEY, perm.directoryUri);
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            perm.directoryUri,
            filename,
            'text/csv'
          );
          await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return true;
        }
      } catch (err) {
        // If SAF fails, we fall through to the share sheet fallback below
        console.warn('SAF save failed; falling back to share sheet', err);
      }
    }

    // Fallback for iOS and Android if SAF was not granted:
    const localUri = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory) + filename;
    await FileSystem.writeAsStringAsync(localUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Prefer expo-sharing when available
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'text/csv',
          dialogTitle: filename,
          UTI: 'public.comma-separated-values-text',
        });
        return true;
      }
    } catch (e) {
      // If expo-sharing throws, try RN Share as a last resort
      console.warn('expo-sharing failed; trying React Native Share', e);
    }

    try {
      await RNShare.share({
        url: localUri,
        title: filename,
        message: `Exported ${data.length} products to ${filename}`,
      });
      return true;
    } catch (e) {
      console.warn('React Native Share failed. File still written locally at:', localUri, e);
      // Even if share failed, the file exists locally.
      return true;
    }
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};
