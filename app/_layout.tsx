import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/hooks/auth-store";
import { WarehouseProvider } from "@/hooks/warehouse-store";
import { StatusBar } from "expo-status-bar";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ 
      headerBackTitle: "Back",
      headerStyle: {
        backgroundColor: '#ffffff',
      },
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="warehouses" options={{ title: "Warehouses", headerShown: false }} />
      <Stack.Screen name="warehouse/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="scanner" options={{ presentation: 'modal', title: "Barcode Scanner" }} />
      <Stack.Screen name="mass-scanner" options={{ presentation: 'modal', title: "Mass Barcode Scanner" }} />
      <Stack.Screen name="import" options={{ presentation: 'modal', title: "Import Products" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WarehouseProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <RootLayoutNav />
          </GestureHandlerRootView>
        </WarehouseProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}