import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  SALON_TIMEZONE,
  type SettingsDoc,
} from '@salon/shared';
import {
  Button,
  Input,
  MutedText,
  Screen,
} from '../../theme/components';
import { spacing } from '../../theme/tokens';
import { firestore } from '../../config/firebase';
import { SETTINGS_DOC_ID, stores } from '../../api/firestore';

export function ManageSettingsScreen(): React.JSX.Element {
  const [salonName, setSalonName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [horizonDays, setHorizonDays] = useState(`${DEFAULT_BOOKING_HORIZON_DAYS}`);
  const [windowHours, setWindowHours] = useState(`${DEFAULT_CANCELLATION_WINDOW_HOURS}`);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    stores.getSettings().then((s) => {
      if (!s) return;
      setSalonName(s.salonName);
      setAddress(s.address);
      setPhone(s.phone);
      setContactEmail(s.contactEmail);
      setHorizonDays(`${s.bookingHorizonDays}`);
      setWindowHours(`${s.cancellationWindowHours}`);
    });
  }, []);

  const save = async (): Promise<void> => {
    const horizon = parseInt(horizonDays, 10);
    const window = parseInt(windowHours, 10);
    if (!Number.isFinite(horizon) || horizon <= 0) {
      Alert.alert('Invalid horizon', 'Must be a positive integer.');
      return;
    }
    if (!Number.isFinite(window) || window < 0) {
      Alert.alert('Invalid window', 'Must be 0 or greater.');
      return;
    }
    setBusy(true);
    try {
      const existing = (await stores.getSettings()) ?? null;
      const next: SettingsDoc = {
        salonName: salonName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        contactEmail: contactEmail.trim(),
        timezone: existing?.timezone ?? SALON_TIMEZONE,
        bookingHorizonDays: horizon,
        cancellationWindowHours: window,
        defaultWorkingHoursTemplate:
          existing?.defaultWorkingHoursTemplate ?? {
            mon: [{ start: '09:00', end: '17:00' }],
            tue: [{ start: '09:00', end: '17:00' }],
            wed: [{ start: '09:00', end: '17:00' }],
            thu: [{ start: '09:00', end: '17:00' }],
            fri: [{ start: '09:00', end: '17:00' }],
            sat: [{ start: '09:00', end: '14:00' }],
            sun: [],
          },
        updatedAt: Date.now(),
      };
      await setDoc(doc(firestore, 'settings', SETTINGS_DOC_ID), next);
      Alert.alert('Saved', 'Salon settings updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Input label="Salon name" value={salonName} onChangeText={setSalonName} />
        <Input label="Address" value={address} onChangeText={setAddress} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input
          label="Contact email"
          value={contactEmail}
          onChangeText={setContactEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Booking horizon (days)"
          value={horizonDays}
          onChangeText={setHorizonDays}
          keyboardType="number-pad"
        />
        <Input
          label="Cancellation window (hours)"
          value={windowHours}
          onChangeText={setWindowHours}
          keyboardType="number-pad"
        />
        <MutedText style={{ marginVertical: spacing.md }}>
          Timezone is hardcoded ({SALON_TIMEZONE}). Change in `shared/src/constants.ts` to relocate.
        </MutedText>
        <Button title="Save" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
