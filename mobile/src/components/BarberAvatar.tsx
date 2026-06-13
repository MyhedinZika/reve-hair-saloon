import { Image, Text, View } from 'react-native';
import { colors, font, radius } from '../theme/tokens';

interface BarberAvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: number;
}

export function BarberAvatar({
  avatarUrl,
  name,
  size = 48,
}: BarberAvatarProps): React.JSX.Element {
  const trimmed = avatarUrl?.trim();
  if (trimmed) {
    return (
      <Image
        source={{ uri: trimmed }}
        style={{
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: colors.bgAlt,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: colors.bgAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: colors.ink,
          fontSize: Math.max(12, Math.round(size * 0.36)),
          fontWeight: font.weight.semibold,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
