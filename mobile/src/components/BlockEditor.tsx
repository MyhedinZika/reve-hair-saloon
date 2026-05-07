import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TimeBlock } from '@salon/shared';
import { BodyText, Button, Input, MutedText } from '../theme/components';
import { colors, font, radius, spacing } from '../theme/tokens';

interface BlockEditorProps {
  blocks: TimeBlock[];
  onChange: (blocks: TimeBlock[]) => void;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function BlockEditor({ blocks, onChange }: BlockEditorProps): React.JSX.Element {
  const [draftStart, setDraftStart] = useState('09:00');
  const [draftEnd, setDraftEnd] = useState('17:00');

  const add = (): void => {
    if (!TIME_PATTERN.test(draftStart) || !TIME_PATTERN.test(draftEnd)) return;
    if (draftStart >= draftEnd) return;
    const next = [...blocks, { start: draftStart, end: draftEnd }].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    onChange(next);
  };

  const remove = (idx: number): void => {
    onChange(blocks.filter((_, i) => i !== idx));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.length === 0 ? (
        <MutedText>No blocks yet.</MutedText>
      ) : null}
      {blocks.map((b, idx) => (
        <View
          key={`${b.start}-${b.end}-${idx}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          <BodyText style={{ fontWeight: font.weight.semibold }}>
            {b.start} – {b.end}
          </BodyText>
          <Pressable onPress={() => remove(idx)}>
            <BodyText style={{ color: colors.danger }}>Remove</BodyText>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Start (HH:MM)" value={draftStart} onChangeText={setDraftStart} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="End (HH:MM)" value={draftEnd} onChangeText={setDraftEnd} />
        </View>
      </View>
      <Button title="Add block" variant="secondary" onPress={add} />
    </View>
  );
}
