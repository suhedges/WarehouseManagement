import React, { useState } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-store';
import { Warehouse } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    if (username.trim() !== 'TSB2108') {
      setError('Invalid username');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim());
      router.replace('/warehouses');
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Warehouse size={64} color={colors.primary} />
            <Text style={styles.title}>Warehouse Manager</Text>
            <Text style={styles.subtitle}>Inventory Management System</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
              testID="username-input"
            />

            <Button
              title="Login"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              testID="login-button"
              style={styles.loginButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[500],
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  loginButton: {
    marginTop: 16,
  },
});