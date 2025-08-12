import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SyncStatus } from '@/components/SyncStatus';
import { colors } from '@/constants/colors';
import { useWarehouse } from '@/hooks/warehouse-store';
import { useAuth } from '@/hooks/auth-store';
import { Warehouse as WarehouseIcon, LogOut, Plus, Package, Settings } from 'lucide-react-native';

export default function WarehousesScreen() {
  const router = useRouter();
  const { warehouses, isLoading, syncStatus, addWarehouse } = useWarehouse();
  const { user, logout } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleAddWarehouse = () => {
    if (!newWarehouseName.trim()) {
      Alert.alert('Error', 'Please enter a warehouse name');
      return;
    }

    const warehouse = addWarehouse(newWarehouseName.trim());
    setNewWarehouseName('');
    setShowAddForm(false);
    
    // Navigate to the new warehouse
    router.push(`/warehouse/${warehouse.id}`);
  };

  if (isLoading) {
    return <LoadingIndicator message="Loading warehouses..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <WarehouseIcon size={24} color={colors.primary} />
            <Text style={styles.title}>Warehouses</Text>
          </View>
          <View style={styles.headerRight}>
            <SyncStatus status={syncStatus} />
            <TouchableOpacity 
              onPress={() => router.push('/github-settings')} 
              style={styles.settingsButton}
            >
              <Settings size={20} color={colors.gray[600]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <LogOut size={20} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.welcomeText}>Welcome, {user?.username}</Text>
      </View>

      {warehouses.length === 0 && !showAddForm ? (
        <EmptyState
          title="No Warehouses"
          description="Create your first warehouse to start managing inventory"
          buttonTitle="Add Warehouse"
          onButtonPress={() => setShowAddForm(true)}
          icon={<Package size={48} color={colors.gray[400]} />}
        />
      ) : (
        <View style={styles.content}>
          {showAddForm ? (
            <Card style={styles.addForm}>
              <Text style={styles.formTitle}>Add New Warehouse</Text>
              <Input
                placeholder="Warehouse Name"
                value={newWarehouseName}
                onChangeText={setNewWarehouseName}
                autoFocus
              />
              <View style={styles.formButtons}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowAddForm(false);
                    setNewWarehouseName('');
                  }}
                  variant="outline"
                  style={styles.cancelButton}
                />
                <Button
                  title="Add Warehouse"
                  onPress={handleAddWarehouse}
                />
              </View>
            </Card>
          ) : (
            <Button
              title="Add Warehouse"
              onPress={() => setShowAddForm(true)}
              icon={<Plus size={20} color="white" />}
              style={styles.addButton}
            />
          )}

          <FlatList
            data={warehouses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/warehouse/${item.id}`)}
                testID={`warehouse-${item.id}`}
              >
                <Card>
                  <View style={styles.warehouseCard}>
                    <WarehouseIcon size={24} color={colors.primary} />
                    <Text style={styles.warehouseName}>{item.name}</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
    marginRight: 4,
  },
  logoutButton: {
    padding: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    marginBottom: 16,
  },
  addForm: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    marginRight: 8,
  },
  warehouseCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warehouseName: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 12,
    color: '#000',
  },
  listContent: {
    paddingBottom: 24,
  },
});