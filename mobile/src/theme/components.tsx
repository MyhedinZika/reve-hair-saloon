import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, spacing } from './tokens';

interface ScreenProps extends ViewProps {
  padded?: boolean;
}

export function Screen({ style, padded = true, ...rest }: ScreenProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        styles.screen,
        padded ? { paddingHorizontal: spacing.lg, paddingTop: spacing.lg } : null,
        style,
      ]}
    />
  );
}

export function Card({ style, ...rest }: ViewProps): React.JSX.Element {
  return <View {...rest} style={[styles.card, style]} />;
}

interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
}

export function Heading({ level = 1, style, ...rest }: HeadingProps): React.JSX.Element {
  const sizes: Record<1 | 2 | 3, number> = {
    1: font.size.display,
    2: font.size.xxl,
    3: font.size.xl,
  };
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: sizes[level],
          fontWeight: font.weight.bold,
          color: colors.ink,
        },
        style,
      ]}
    />
  );
}

export function BodyText({ style, ...rest }: TextProps): React.JSX.Element {
  return (
    <Text
      {...rest}
      style={[{ fontSize: font.size.md, color: colors.ink }, style]}
    />
  );
}

export function MutedText({ style, ...rest }: TextProps): React.JSX.Element {
  return (
    <Text
      {...rest}
      style={[{ fontSize: font.size.sm, color: colors.muted }, style]}
    />
  );
}

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  loading,
  disabled,
  variant = 'primary',
  style,
  ...rest
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.ink }
      : variant === 'secondary'
        ? { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.border }
        : variant === 'danger'
          ? { backgroundColor: colors.danger }
          : { backgroundColor: 'transparent' };
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? colors.inkOnAccent
      : colors.ink;
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={[
        styles.button,
        variantStyle,
        isDisabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontWeight: font.weight.semibold, fontSize: font.size.md }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  errorText?: string | null;
}

export function Input({
  label,
  errorText,
  style,
  ...rest
}: InputProps): React.JSX.Element {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={styles.inputLabel}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...rest}
        style={[
          styles.input,
          errorText ? { borderColor: colors.danger } : null,
          style,
        ]}
      />
      {errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : null}
    </View>
  );
}

interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Pill({
  label,
  selected,
  onPress,
  style,
  textStyle,
}: PillProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        selected ? { backgroundColor: colors.ink } : null,
        style,
      ]}
    >
      <Text
        style={[
          {
            color: selected ? colors.inkOnAccent : colors.ink,
            fontWeight: font.weight.medium,
            fontSize: font.size.sm,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface DividerProps {
  vertical?: boolean;
}

export function Divider({ vertical }: DividerProps): React.JSX.Element {
  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: 'stretch', backgroundColor: colors.border }
          : { height: 1, backgroundColor: colors.border, marginVertical: spacing.md }
      }
    />
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inputLabel: {
    fontSize: font.size.sm,
    color: colors.muted,
    marginBottom: spacing.xs,
    fontWeight: font.weight.medium,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.size.md,
    color: colors.ink,
  },
  errorText: {
    color: colors.danger,
    fontSize: font.size.xs,
    marginTop: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
});
