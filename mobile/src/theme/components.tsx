import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from './tokens';

interface ScreenProps extends ViewProps {
  padded?: boolean;
  /**
   * Dismiss the keyboard when the user taps an area outside an input.
   * Defaults to true; pass false on screens whose taps would conflict
   * (e.g., screens with their own gesture handlers).
   */
  dismissKeyboardOnTap?: boolean;
}

export function Screen({
  style,
  padded = true,
  dismissKeyboardOnTap = true,
  children,
  ...rest
}: ScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[
        styles.screen,
        { paddingTop: insets.top + (padded ? spacing.lg : 0) },
        padded ? { paddingHorizontal: spacing.xl } : null,
        style,
      ]}
    >
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback
          onPress={() => Keyboard.dismiss()}
          accessible={false}
        >
          <View style={{ flex: 1 }}>{children}</View>
        </TouchableWithoutFeedback>
      ) : (
        children
      )}
    </View>
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
          fontWeight: font.weight.semibold,
          color: colors.ink,
          letterSpacing: 0,
          lineHeight: Math.round(sizes[level] * 1.14),
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
      style={[styles.bodyText, style]}
    />
  );
}

export function MutedText({ style, ...rest }: TextProps): React.JSX.Element {
  return (
    <Text
      {...rest}
      style={[styles.mutedText, style]}
    />
  );
}

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  loading,
  disabled,
  variant = 'primary',
  style,
  textStyle,
  ...rest
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.ink }
      : variant === 'accent'
        ? { backgroundColor: colors.accent }
      : variant === 'secondary'
        ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong }
        : variant === 'danger'
          ? { backgroundColor: colors.danger }
          : { backgroundColor: 'transparent' };
  const textColor =
    variant === 'primary' || variant === 'accent' || variant === 'danger'
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
        <Text
          style={[
            {
              color: textColor,
              fontWeight: font.weight.semibold,
              fontSize: font.size.lg,
            },
            textStyle,
          ]}
        >
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
  selectedTone?: 'ink' | 'accent';
}

export function Pill({
  label,
  selected,
  onPress,
  style,
  textStyle,
  selectedTone = 'ink',
}: PillProps): React.JSX.Element {
  const selectedColor = selectedTone === 'accent' ? colors.accent : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: selectedColor, borderColor: selectedColor }
          : null,
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

interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  label,
  children,
  style,
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      {...rest}
      style={({ pressed }) => [
        styles.iconButton,
        pressed ? { opacity: 0.75 } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

interface BottomBarProps extends ViewProps {
  bordered?: boolean;
}

export function BottomBar({
  style,
  bordered = true,
  ...rest
}: BottomBarProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        styles.bottomBar,
        bordered ? { borderTopWidth: 1, borderTopColor: colors.border } : null,
        style,
      ]}
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
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyText: {
    fontSize: font.size.lg,
    lineHeight: 21,
    color: colors.ink,
    letterSpacing: 0,
  },
  mutedText: {
    fontSize: font.size.md,
    lineHeight: 20,
    color: colors.mutedStrong,
    letterSpacing: 0,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inputLabel: {
    fontSize: font.size.sm,
    color: colors.inkSoft,
    marginBottom: 7,
    fontWeight: font.weight.semibold,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
    fontSize: font.size.lg,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
