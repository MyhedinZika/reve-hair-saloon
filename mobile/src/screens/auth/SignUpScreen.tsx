import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Heading, Input, MutedText, Screen } from '../../theme/components';
import { spacing } from '../../theme/tokens';
import { signUpWithEmail } from '../../auth/api';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (): Promise<void> => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, name.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Heading level={1} style={{ marginBottom: spacing.xs }}>
          Create account
        </Heading>
        <MutedText style={{ marginBottom: spacing.xl }}>It only takes a minute.</MutedText>

        <Input label="Full name" value={name} onChangeText={setName} />
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

        <Button title="Create account" onPress={handleSignUp} loading={loading} />

        <View style={{ height: spacing.lg }} />

        <Button
          title="I already have an account"
          variant="ghost"
          onPress={() => navigation.navigate('SignIn')}
        />
      </View>
    </Screen>
  );
}
