import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { CheckCircle, CloudOff } from 'lucide-react-native';

interface SyncStatusProps {
  status: 'synced' | 'pending';
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ status }) => {
  return (
    <View style={styles.container}>
      {status === 'synced' ? (
        <>
          <CheckCircle size={16} color={colors.success} />
          <Text style={styles.syncedText}>Synced</Text>
        </>
      ) : (
        <>
          <CloudOff size={16} color={colors.warning} />
          <Text style={styles.pendingText}>Pending sync</Text>
        </>
      )}
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
});