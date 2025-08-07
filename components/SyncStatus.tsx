import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { CheckCircle, CloudOff, RefreshCw, AlertCircle } from 'lucide-react-native';

interface SyncStatusProps {
  status: 'synced' | 'pending' | 'syncing' | 'error';
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ status }) => {
  const getStatusContent = () => {
    switch (status) {
      case 'synced':
        return {
          icon: <CheckCircle size={16} color={colors.success} />,
          text: 'Synced',
          textStyle: styles.syncedText,
        };
      case 'syncing':
        return {
          icon: <RefreshCw size={16} color={colors.primary} />,
          text: 'Syncing...',
          textStyle: styles.syncingText,
        };
      case 'error':
        return {
          icon: <AlertCircle size={16} color={colors.danger} />,
          text: 'Sync failed',
          textStyle: styles.errorText,
        };
      case 'pending':
      default:
        return {
          icon: <CloudOff size={16} color={colors.warning} />,
          text: 'Pending sync',
          textStyle: styles.pendingText,
        };
    }
  };

  const { icon, text, textStyle } = getStatusContent();

  return (
    <View style={styles.container}>
      {icon}
      <Text style={textStyle}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  syncedText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.success,
  },
  pendingText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.warning,
  },
  syncingText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.primary,
  },
  errorText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.danger,
  },
});