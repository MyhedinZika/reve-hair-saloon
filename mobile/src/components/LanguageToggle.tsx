import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useI18n, type Language } from '../i18n/I18nContext';
import { colors, font, radius, spacing } from '../theme/tokens';

interface LanguageToggleProps {
  style?: StyleProp<ViewStyle>;
  tone?: 'dark' | 'light';
}

const OPTIONS: Array<{ label: string; value: Language }> = [
  { label: 'SQ', value: 'sq' },
  { label: 'EN', value: 'en' },
];

export function LanguageToggle({
  style,
  tone = 'light',
}: LanguageToggleProps): React.JSX.Element {
  const { language, setLanguage } = useI18n();
  const dark = tone === 'dark';

  return (
    <View
      style={[
        styles.root,
        dark ? styles.rootDark : null,
        style,
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = language === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              void setLanguage(option.value);
            }}
            style={[
              styles.option,
              selected ? (dark ? styles.optionSelectedDark : styles.optionSelected) : null,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                dark ? styles.optionTextDark : null,
                selected ? styles.optionTextSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 3,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rootDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  option: {
    minWidth: 38,
    minHeight: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.ink,
  },
  optionSelectedDark: {
    backgroundColor: colors.accent,
  },
  optionText: {
    color: colors.mutedStrong,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  optionTextDark: {
    color: colors.card,
  },
  optionTextSelected: {
    color: colors.inkOnAccent,
  },
});
