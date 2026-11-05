import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { socialLinks } from '@shared/social';
import { Text } from './ui/Typography';

const icons = { instagram: '◎', facebook: 'f', youtube: '▶', googleMaps: '⌖', whatsapp: '◉' };
export function SocialLinks() {
  const [error, setError] = useState('');
  const links = socialLinks();
  if (!links.length) return null;
  return <View style={{ padding: 16, gap: 10 }}>
    <Text style={{ fontWeight: '700' }}>Follow and find us</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{links.map((link) =>
      <Pressable key={link.key} accessibilityRole="link" accessibilityLabel={link.label}
        onPress={() => { setError(''); Linking.openURL(link.href).catch(() => setError('This link could not be opened.')); }}
        style={{ padding: 10, backgroundColor: '#e2e8f0', borderRadius: 10 }}>
        <Text style={{ color: '#2563eb', fontWeight: '600' }}>{icons[link.key]} {link.label}</Text>
      </Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" style={{ color: '#dc2626' }}>{error}</Text>}
  </View>;
}
