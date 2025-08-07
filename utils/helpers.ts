import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';
import { Product } from '@/types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

export const parseCSV = (csvString: string): any[] => {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',').map(value => value.trim());
    const obj: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Convert numeric values
      if (['minAmount', 'maxAmount', 'quantity'].includes(header)) {
        obj[header] = parseInt(value, 10) || 0;
      } else {
        obj[header] = value;
      }
    });
    
    return obj;
  });
};

export const generateCSV = (products: Product[]): string => {
  const headers = ['internalName', 'customerName', 'barcode', 'location', 'minAmount', 'maxAmount', 'quantity'];
  const headerRow = headers.join(',');
  
  const rows = products.map(product => {
    return headers.map(header => {
      const value = product[header as keyof Product];
      return typeof value === 'string' ? `"${value}"` : value;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
};

export const exportCSV = async (data: Product[], filename: string): Promise<boolean> => {
  try {
    const csvContent = generateCSV(data);
    console.log('Exporting CSV with content:', csvContent.substring(0, 200) + '...');
    console.log('Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      // For web, create a download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create and trigger download
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
      
      console.log('CSV download initiated for:', filename);
      return true;
    } else {
      // For mobile, save to file and share
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      console.log('CSV saved to:', filePath);
      
      await Share.share({
        url: filePath,
        title: filename,
        message: `Exported ${data.length} products to ${filename}`,
      });
      return true;
    }
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};