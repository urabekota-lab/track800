import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider, useApp } from './lib/AppContext'
import { colors } from './lib/theme'
import HomeScreen from './screens/HomeScreen'
import LogScreen from './screens/LogScreen'
import SuggestScreen from './screens/SuggestScreen'
import MenuLibraryScreen from './screens/MenuLibraryScreen'
import MenuDetailScreen from './screens/MenuDetailScreen'
import MenuBuilderScreen from './screens/MenuBuilderScreen'
import SettingsScreen from './screens/SettingsScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

type IconName = keyof typeof Ionicons.glyphMap

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  )
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="ホーム"
        component={HomeScreen}
        options={{ tabBarIcon: tabIcon('speedometer', 'speedometer-outline') }}
      />
      <Tab.Screen
        name="記録"
        component={LogScreen}
        options={{ tabBarIcon: tabIcon('stopwatch', 'stopwatch-outline') }}
      />
      <Tab.Screen
        name="提案"
        component={SuggestScreen}
        options={{ tabBarIcon: tabIcon('bulb', 'bulb-outline') }}
      />
      <Tab.Screen
        name="メニュー"
        component={MenuLibraryScreen}
        options={{ tabBarIcon: tabIcon('list', 'list-outline') }}
      />
      <Tab.Screen
        name="設定"
        component={SettingsScreen}
        options={{ tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tab.Navigator>
  )
}

function Root() {
  const { loading } = useApp()

  // 保存済みデータを読む間だけ待つ。ログインはない
  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="メニュー詳細" component={MenuDetailScreen} />
        <Stack.Screen name="メニュー作成" component={MenuBuilderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
})
