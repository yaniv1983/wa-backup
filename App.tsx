import React, {useState, useEffect} from 'react';
import {View, Text, I18nManager, ActivityIndicator} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Force LTR layout regardless of device locale
if (I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SetupWizard from './src/screens/SetupWizard';
import {colors} from './src/theme';

const Tab = createBottomTabNavigator();
const SETUP_KEY = '@wa_setup_complete';

function HeaderTitle({title}: {title: string}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
      <Icon name="cloud-upload" size={22} color="#fff" />
      <Text style={{color: '#fff', fontSize: 18, fontWeight: '700'}}>{title}</Text>
    </View>
  );
}

export default function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SETUP_KEY).then(value => {
      setSetupComplete(value === 'true');
    });
  }, []);

  const handleSetupComplete = async () => {
    await AsyncStorage.setItem(SETUP_KEY, 'true');
    setSetupComplete(true);
  };

  // Loading state
  if (setupComplete === null) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'}}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // First-run wizard
  if (!setupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  // Main app
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: colors.primary, elevation: 4},
          headerTintColor: '#fff',
          headerTitleStyle: {fontWeight: '700'},
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerTitle: () => <HeaderTitle title="WA Backup" />,
            tabBarIcon: ({color, size}) => (
              <Icon name="cloud-upload" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            headerTitle: () => <HeaderTitle title="History" />,
            tabBarIcon: ({color, size}) => (
              <Icon name="history" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerTitle: () => <HeaderTitle title="Settings" />,
            tabBarIcon: ({color, size}) => (
              <Icon name="cog" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
