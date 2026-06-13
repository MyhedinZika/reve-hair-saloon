import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppointmentDoc, BarberDoc, ServiceDoc } from '@salon/shared';
import { LanguageToggle } from '../../components/LanguageToggle';
import { BodyText, Card, Heading, MutedText, Screen } from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { stores } from '../../api/firestore';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateLong, formatTimeOfDay } from '../../util/format';
import type { ClientStackParamList, ClientTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ClientTabParamList, 'Home'>,
  NativeStackScreenProps<ClientStackParamList>
>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [upcoming, setUpcoming] = useState<AppointmentDoc | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    stores.listBarbers().then(setBarbers).catch(() => setBarbers([]));
    stores.listServices().then(setServices).catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const unsub = stores.watchClientAppointments(profile.uid, (docs) => {
      const now = Date.now();
      const next = docs
        .filter((d) => d.status === 'confirmed' && d.startAt > now)
        .sort((a, b) => a.startAt - b.startAt)[0];
      setUpcoming(next ?? null);
    });
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    if (!showAccountMenu) return;
    accountMenuAnim.setValue(0);
    Animated.timing(accountMenuAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [accountMenuAnim, showAccountMenu]);

  const firstName = profile?.displayName.split(' ')[0] ?? t('guest');

  const startBooking = (): void => {
    navigation.navigate('BookingFlow', { screen: 'Book' });
  };

  const upcomingBarber = upcoming ? barbers.find((barber) => barber.id === upcoming.barberId) : null;
  const upcomingServices = upcoming
    ? services.filter((service) => upcoming.serviceIds.includes(service.id))
    : [];
  const upcomingServiceLabel =
    upcomingServices.length > 0
      ? upcomingServices.map((service) => service.name).join(' & ')
      : t('serviceCount', { count: upcoming?.serviceIds.length ?? 0 });

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>r</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandText}>rêve</Text>
          <Text style={styles.brandSubtext}>{t('hairSalon')}</Text>
        </View>
        <Pressable
          accessibilityLabel={t('profile')}
          onPress={() => setShowAccountMenu((visible) => !visible)}
          style={({ pressed }) => [
            styles.profileDot,
            showAccountMenu ? styles.profileDotActive : null,
            pressed ? { opacity: 0.78 } : null,
          ]}
        >
          <Text style={styles.profileDotText}>{initials(profile?.displayName ?? t('defaultClientName'))}</Text>
        </Pressable>
      </View>

      {showAccountMenu ? (
        <View style={styles.menuLayer} pointerEvents="box-none">
          <Pressable
            accessibilityLabel={t('closeAccountMenu')}
            onPress={() => setShowAccountMenu(false)}
            style={styles.menuBackdrop}
          />
          <Animated.View
            style={[
              styles.accountMenu,
              {
                opacity: accountMenuAnim,
                transform: [
                  {
                    translateY: accountMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: accountMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.accountMenuHeader}>
              <View style={styles.menuAvatar}>
                <Text style={styles.profileDotText}>{initials(profile?.displayName ?? t('defaultClientName'))}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <BodyText style={styles.menuName}>
                  {profile?.displayName ?? t('defaultClientName')}
                </BodyText>
                {profile?.email ? (
                  <MutedText style={styles.menuEmail} numberOfLines={1}>
                    {profile.email}
                  </MutedText>
                ) : null}
              </View>
            </View>
            <View style={styles.languageRow}>
              <Text style={styles.languageLabel}>{t('language')}</Text>
              <LanguageToggle style={{ alignSelf: 'center' }} />
            </View>
            <Pressable
              accessibilityLabel={t('signOut')}
              onPress={() => void signOut()}
              style={({ pressed }) => [
                styles.logoutAction,
                pressed ? { backgroundColor: colors.dangerSoft } : null,
              ]}
            >
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={startBooking} style={styles.hero}>
          <MutedText style={{ color: '#B1B1B9' }}>
            {t('goodMorning', { name: firstName })}
          </MutedText>
          <Heading level={1} style={styles.heroTitle}>
            {t('readyFreshCut')}
          </Heading>
          <MutedText style={styles.heroCopy}>
            {t('pickFreshCut')}
          </MutedText>
          <View style={styles.heroButton}>
            <Text style={styles.heroButtonText}>{t('bookAppointment')}</Text>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionKicker}>{t('upcomingKicker')}</Text>
        </View>
        {upcoming ? (
          <Card style={styles.upcomingCard}>
            <View style={styles.appointmentIcon}>
              <Text style={styles.appointmentIconText}>DB</Text>
            </View>
            <View style={{ flex: 1 }}>
              <BodyText style={{ fontWeight: font.weight.semibold }}>
                {upcomingServiceLabel}
              </BodyText>
              <MutedText>
                {t('withBarber', { barber: upcomingBarber?.displayName ?? t('yourBarber') })} - {formatDateLong(upcoming.startAt)}, {formatTimeOfDay(upcoming.startAt)}
              </MutedText>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{t('appointmentConfirmed')}</Text>
            </View>
          </Card>
        ) : (
          <Card>
            <MutedText>{t('noUpcomingAppointment')}</MutedText>
          </Card>
        )}

        {barbers.length > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>{t('ourBarbers')}</Text>
              <Text style={styles.sectionLink}>{t('seeAll')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}
            >
              {barbers.map((barber, index) => (
                <View key={barber.id} style={styles.barberCard}>
                  <View style={styles.avatar}>
                    {barber.avatarUrl ? (
                      <Image source={{ uri: barber.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(barber.displayName)}</Text>
                    )}
                  </View>
                  <BodyText style={styles.barberName}>{firstWord(barber.displayName)}</BodyText>
                  <MutedText style={{ fontSize: font.size.sm }}>
                    {index === 0 ? t('masterBarber') : index === 1 ? t('seniorStylist') : t('barber')}
                  </MutedText>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
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

function firstWord(name: string): string {
  return name.split(' ')[0] ?? name;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: colors.accent,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
  },
  brandText: {
    color: colors.ink,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
    lineHeight: 22,
  },
  brandSubtext: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: font.weight.semibold,
    letterSpacing: 2.2,
    marginTop: 3,
  },
  profileDot: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  profileDotText: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  menuLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  accountMenu: {
    position: 'absolute',
    top: 62,
    right: spacing.xl,
    width: 258,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  accountMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuName: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  menuEmail: {
    fontSize: font.size.sm,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageLabel: {
    color: colors.ink,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  logoutAction: {
    minHeight: 42,
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  logoutText: {
    color: colors.danger,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    minHeight: 214,
  },
  heroTitle: {
    color: colors.card,
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  heroCopy: {
    color: '#B1B1B9',
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  heroButton: {
    marginTop: spacing.xxl,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    color: colors.card,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionKicker: {
    color: colors.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.6,
  },
  sectionLink: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appointmentIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentIconText: {
    color: colors.accent,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  statusPillText: {
    color: colors.success,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  barberCard: {
    width: 96,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: '#ECECEF',
    marginBottom: spacing.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
  },
  avatarText: {
    color: colors.mutedSoft,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  barberName: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    textAlign: 'center',
  },
});
