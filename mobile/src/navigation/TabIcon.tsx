import { Text } from 'react-native';
import { font } from '../theme/tokens';

export type TabIconName =
  | 'appointments'
  | 'dashboard'
  | 'home'
  | 'hours'
  | 'inbox'
  | 'manage'
  | 'profile'
  | 'schedule';

const GLYPH: Record<TabIconName, string> = {
  appointments: '□',
  dashboard: '▦',
  home: '⌂',
  hours: '◴',
  inbox: '✉',
  manage: '+',
  profile: '○',
  schedule: '◷',
};

interface TabIconProps {
  color: string;
  focused: boolean;
  name: TabIconName;
}

export function TabIcon({ color, focused, name }: TabIconProps): React.JSX.Element {
  return (
    <Text
      style={{
        color,
        fontSize: focused ? 24 : 22,
        fontWeight: font.weight.semibold,
        lineHeight: 25,
      }}
    >
      {GLYPH[name]}
    </Text>
  );
}
