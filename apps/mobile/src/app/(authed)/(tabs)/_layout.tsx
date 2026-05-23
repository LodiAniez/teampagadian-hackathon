import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View className="items-center">
      <Text className={focused ? "text-brand-600 font-semibold text-xs" : "text-gray-400 text-xs"}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#059669",
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarLabel: "Invoices",
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "AI Chat",
          tabBarLabel: "Chat",
        }}
      />
      <Tabs.Screen
        name="tax"
        options={{
          title: "Tax",
          tabBarLabel: "Tax",
        }}
      />
    </Tabs>
  );
}
