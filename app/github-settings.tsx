import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Github, Trash2, RefreshCw, RotateCcw } from 'lucide-react-native';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useWarehouse } from '@/hooks/warehouse-store';
import { useAuth } from '@/hooks/auth-store';
import { SyncStatus } from '@/components/SyncStatus';

export default function GitHubSettingsScreen() {
  const { 
    githubConfig, 
    configureGitHub, 
    disconnectGitHub, 
    performSync, 
    syncStatus,
    lastSyncTime,
    resetSyncSnapshot,
  } = useWarehouse();
  const { user } = useAuth();
  
  const [token, setToken] = useState<string>(githubConfig?.token || '');
  const [owner, setOwner] = useState<string>(githubConfig?.owner || '');
  const [repo, setRepo] = useState<string>(githubConfig?.repo || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSave = async () => {
    if (!token.trim() || !owner.trim() || !repo.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await configureGitHub({
        token: token.trim(),
        owner: owner.trim(),
        repo: repo.trim(),
      });
      
      Alert.alert('Success', 'GitHub configuration saved and synced successfully!');
    } catch (error) {
      console.error('Failed to configure GitHub:', error);
      Alert.alert(
        'Error', 
        error instanceof Error ? error.message : 'Failed to configure GitHub'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect GitHub',
      'Are you sure you want to disconnect GitHub? This will stop automatic syncing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectGitHub();
              setToken('');
              setOwner('');
              setRepo('');
              Alert.alert('Success', 'GitHub disconnected successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect GitHub');
            }
          },
        },
      ]
    );
  };

  const handleManualSync = async () => {
    try {
      setIsLoading(true);
      await performSync();
      Alert.alert('Success', 'Manual sync completed successfully!');
    } catch (error) {
      console.error('Manual sync failed:', error);
      Alert.alert(
        'Sync Failed', 
        error instanceof Error ? error.message : 'Failed to sync with GitHub'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'GitHub Settings',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Github size={48} color="#24292e" />
          <Text style={styles.title}>GitHub Sync</Text>
          <Text style={styles.subtitle}>
            Sync your warehouse data to a GitHub repository
          </Text>
        </View>

        {githubConfig && (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Sync Status</Text>
            <SyncStatus status={syncStatus} />
            <Text style={styles.lastSync}>
              Last sync: {formatLastSync(lastSyncTime)}
            </Text>
            
            <Button
              title="Manual Sync"
              onPress={handleManualSync}
              disabled={isLoading || syncStatus === 'syncing'}
              style={styles.syncButton}
              icon={<RefreshCw size={20} color="#fff" />}
            />
          </View>
        )}

        {githubConfig && (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Advanced</Text>
            <Button
              title="Reset Sync Snapshot"
              onPress={async () => {
                try {
                  setIsLoading(true);
                  await resetSyncSnapshot();
                  Alert.alert('Snapshot Reset', 'Base snapshot cleared. Next sync will treat current local data as baseline.');
                } catch (e) {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reset');
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
              icon={<RotateCcw size={20} color="#0366d6" />}
            />
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Repository Configuration</Text>
          
          <Input
            label="GitHub Token"
            value={token}
            onChangeText={setToken}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <Input
            label="Repository Owner"
            value={owner}
            onChangeText={setOwner}
            placeholder="your-username"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <Input
            label="Repository Name"
            value={repo}
            onChangeText={setRepo}
            placeholder="warehouse-data"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.helpText}>
            <Text style={styles.helpTitle}>Setup Instructions:</Text>
            <Text style={styles.helpItem}>1. Create a GitHub repository</Text>
            <Text style={styles.helpItem}>2. Generate a Personal Access Token with &apos;repo&apos; permissions</Text>
            <Text style={styles.helpItem}>3. Enter your token, username, and repository name above</Text>
            <Text style={styles.helpItem}>4. Data file per user: &apos;warehouse-data-{'{username}'}.json&apos; (current: &apos;warehouse-data-&apos; + {(user?.username ?? 'local')} + &apos;.json&apos;)</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title={githubConfig ? "Update Configuration" : "Save Configuration"}
            onPress={handleSave}
            disabled={isLoading}
            loading={isLoading}
          />
          
          {githubConfig && (
            <Button
              title="Disconnect GitHub"
              onPress={handleDisconnect}
              variant="outline"
              style={styles.disconnectButton}
              icon={<Trash2 size={20} color="#dc3545" />}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#24292e',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6a737d',
    textAlign: 'center',
    marginTop: 8,
  },
  statusSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24292e',
    marginBottom: 16,
  },
  lastSync: {
    fontSize: 14,
    color: '#6a737d',
    marginTop: 8,
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: '#0366d6',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpText: {
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#24292e',
    marginBottom: 8,
  },
  helpItem: {
    fontSize: 14,
    color: '#6a737d',
    marginBottom: 4,
  },
  actions: {
    gap: 12,
    marginBottom: 40,
  },
  disconnectButton: {
    borderColor: '#dc3545',
  },
});