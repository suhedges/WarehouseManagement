import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-store';
import { Warehouse } from 'lucide-react-native';

const VALID_USERNAMES = new Set(['TSB2108', 'TSB414', 'TSB211', 'TSB1609', 'TSB5117', 'TSB1800', 'TSB2205', 'TSB1115', 'TSB1216', 'TSB716']);

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const loadSavedUsername = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem('saved_username');
        if (savedUsername) {
          setUsername(savedUsername);
          setRememberMe(true);
        }
      } catch (err) {
        console.error('Failed to load saved username', err);
      }
    };

    loadSavedUsername();
  }, []);

  const handleLogin = async () => {
    const input = username.trim();

    if (!input) {
      setError('Please enter your username');
      return;
    }

    if (!VALID_USERNAMES.has(input)) {
      setError('Invalid username');
      return;
    }

    setIsLoading(true);
    try {
      await login(input);
      if (rememberMe) {
        await AsyncStorage.setItem('saved_username', input);
      } else {
        await AsyncStorage.removeItem('saved_username');
      }      
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
            <Text style={styles.title}>TriZen</Text>
            <Text style={styles.subtitle}>The Chillest Inventory System</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={(text) => {
                setUsername(text.toUpperCase());
                setError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={error}
              testID="username-input"
            />
            <View style={styles.rememberContainer}>
              <Text style={styles.rememberText}>Remember Username</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                testID="remember-switch"
              />
            </View>
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
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rememberText: {
    fontSize: 16,
    color: colors.text,
  },  
});
