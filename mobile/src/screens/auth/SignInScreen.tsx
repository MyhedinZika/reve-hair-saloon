import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Heading, Input, MutedText, Screen } from '../../theme/components';
import { spacing } from '../../theme/tokens';
import { signInWithEmail } from '../../auth/api';
import { useGoogleSignIn } from '../../auth/google';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const google = useGoogleSignIn();

  const handleSignIn = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await google.prompt();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Heading level={1} style={{ marginBottom: spacing.xs }}>
          Welcome back
        </Heading>
        <MutedText style={{ marginBottom: spacing.xl }}>Sign in to book your next visit.</MutedText>

        <Input
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          errorText={error}
        />

        <Button title="Sign in" onPress={handleSignIn} loading={loading} />

        <View style={{ height: spacing.md }} />

        <Button
          title="Continue with Google"
          variant="secondary"
          onPress={handleGoogle}
          disabled={!google.ready || loading}
        />

        <View style={{ height: spacing.lg }} />

        <Button
          title="Create an account"
          variant="ghost"
          onPress={() => navigation.navigate('SignUp')}
        />
      </View>
    </Screen>
  );
}
