import { View } from 'react-native';
import { BodyText, Heading, Screen } from '../theme/components';
import { spacing } from '../theme/tokens';

interface PlaceholderProps {
  title: string;
  hint?: string;
}

export function PlaceholderScreen({ title, hint }: PlaceholderProps): React.JSX.Element {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Heading level={2}>{title}</Heading>
        {hint ? (
          <BodyText style={{ marginTop: spacing.md, textAlign: 'center' }}>{hint}</BodyText>
        ) : null}
      </View>
    </Screen>
  );
}
