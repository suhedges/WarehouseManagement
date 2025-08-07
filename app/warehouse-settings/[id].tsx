import React from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { ArrowLeft, Trash2, Settings } from 'lucide-react-native';

export default function WarehouseSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getWarehouse, deleteWarehouse } = useWarehouse();
  
  const warehouse = getWarehouse(id);

  const handleDeleteWarehouse = () => {
    Alert.alert(
      'Delete Warehouse',
      `Are you sure you want to delete "${warehouse?.name}"? This will delete all products in this warehouse and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWarehouse(id);
            router.replace('/warehouses');
          },
        },
      ]
    );
  };

  if (!warehouse) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Warehouse not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Warehouse Settings</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.warehouseCard}>
          <View style={styles.warehouseInfo}>
            <Settings size={24} color={colors.primary} />
            <View style={styles.warehouseDetails}>
              <Text style={styles.warehouseName}>{warehouse.name}</Text>
              <Text style={styles.warehouseId}>ID: {warehouse.id}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.sectionDescription}>
            These actions cannot be undone. Please be careful.
          </Text>
          
          <View style={styles.dangerAction}>
            <View style={styles.actionInfo}>
              <Trash2 size={20} color={colors.danger} />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Delete Warehouse</Text>
                <Text style={styles.actionDescription}>
                  Permanently delete this warehouse and all its products
                </Text>
              </View>
            </View>
            <Button
              title="Delete"
              onPress={handleDeleteWarehouse}
              variant="danger"
              style={styles.deleteButton}
            />
          </View>
        </Card>
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  warehouseCard: {
    marginBottom: 16,
  },
  warehouseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warehouseDetails: {
    marginLeft: 12,
    flex: 1,
  },
  warehouseName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  warehouseId: {
    fontSize: 14,
    color: colors.gray[500],
  },
  settingsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: 16,
  },
  dangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    borderOpacity: 0.2,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    marginLeft: 12,
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.gray[600],
  },
  deleteButton: {
    minWidth: 80,
  },
});