import { Pressable, View } from 'react-native';
import { Text } from './Typography';

export function QuantitySelector({ value, max, onChange, label = 'Quantity' }: {
  value: number; max: number; onChange: (value: number) => void; label?: string;
}) {
  return <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} disabled={value <= 1 || max < 1}
      onPress={() => onChange(Math.max(1, Math.min(max, value - 1)))} style={{ padding: 10, borderRadius: 8, backgroundColor: '#e2e8f0', opacity: value <= 1 || max < 1 ? .4 : 1 }}><Text>−</Text></Pressable>
    <Text accessibilityLiveRegion="polite" style={{ fontWeight: '600' }}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} disabled={value >= max || max < 1}
      onPress={() => onChange(Math.min(max, value + 1))} style={{ padding: 10, borderRadius: 8, backgroundColor: '#e2e8f0', opacity: value >= max || max < 1 ? .4 : 1 }}><Text>+</Text></Pressable>
  </View>;
}
