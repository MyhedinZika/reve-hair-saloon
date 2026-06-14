import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_BOOKING_HORIZON_DAYS,
  MAX_DAILY_BOOKINGS_PER_CLIENT,
  addDaysToDateString,
  dayOfWeekFromDateString,
  parseDateString,
  todayDateString,
  type BarberDoc,
  type ServiceDoc,
} from '@salon/shared';
import {
  BodyText,
  BottomBar,
  Button,
  Card,
  Heading,
  IconButton,
  MutedText,
  Screen,
} from '../../theme/components';
import { colors, font, radius, spacing } from '../../theme/tokens';
import { api } from '../../api/functions';
import { stores } from '../../api/firestore';
import { BarberAvatar } from '../../components/BarberAvatar';
import { useI18n, type TranslationKey } from '../../i18n/I18nContext';
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatPrice,
  formatTimeOfDay,
} from '../../util/format';
import type { BookingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BookingStackParamList, 'Book'>;

const STEP_COUNT = 3;

const DOW_SHORT: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function BookingScreen({ navigation, route }: Props): React.JSX.Element {
  const preselectedBarberId = route.params?.barberId ?? null;
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [barberId, setBarberId] = useState<string | null>(preselectedBarberId);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(todayDateString());
  const [slots, setSlots] = useState<number[] | null>(null);
  const [unavailableSlots, setUnavailableSlots] = useState<number[]>([]);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAvail, setNextAvail] = useState<
    { date: string; slot: number } | 'searching' | 'none' | null
  >(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    stores.listBarbers().then((bs) => setBarbers(bs.filter((b) => b.active)));
    stores.listServices().then((ss) => setServices(ss.filter((s) => s.active)));
  }, []);

  useEffect(() => {
    if (preselectedBarberId && preselectedBarberId !== barberId) {
      setBarberId(preselectedBarberId);
      setSelectedServices(new Set());
      setStartAt(null);
    }
    // We only react to incoming preselection changes; user picks are tracked separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedBarberId]);

  const selectedBarber = useMemo(
    () => barbers.find((b) => b.id === barberId) ?? null,
    [barbers, barberId],
  );

  const visibleServices = useMemo(() => {
    if (!selectedBarber) return [];
    return services.filter((s) => selectedBarber.serviceIds.includes(s.id));
  }, [services, selectedBarber]);

  const selectedServiceDocs = useMemo(
    () => services.filter((s) => selectedServices.has(s.id)),
    [services, selectedServices],
  );

  const totalMinutes = useMemo(
    () => selectedServiceDocs.reduce((acc, s) => acc + s.durationMinutes, 0),
    [selectedServiceDocs],
  );

  const totalCents = useMemo(
    () => selectedServiceDocs.reduce((acc, s) => acc + s.priceCents, 0),
    [selectedServiceDocs],
  );

  const dates = useMemo(() => {
    const today = todayDateString();
    const out: string[] = [];
    for (let i = 0; i < DEFAULT_BOOKING_HORIZON_DAYS; i++) {
      out.push(addDaysToDateString(today, i));
    }
    return out;
  }, []);

useEffect(() => {
    if (!barberId || totalMinutes === 0) {
      setSlots(null);
      setUnavailableSlots([]);
      setStartAt(null);
      setNextAvail(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    setUnavailableSlots([]);
    setStartAt(null);
    setNextAvail(null);
    api
      .getAvailableSlots({ barberId, date, serviceDurationMinutes: totalMinutes })
      .then((r) => {
        if (cancelled) return;
        setSlots(r.slots);
        setUnavailableSlots(r.unavailable ?? []);
        if (r.slots.length === 0) {
          setNextAvail('searching');
          api
            .nextAvailable({ barberId, fromDate: date, serviceDurationMinutes: totalMinutes })
            .then((n) => {
              if (cancelled) return;
              if (n.date && n.slot !== null) {
                setNextAvail({ date: n.date, slot: n.slot });
              } else {
                setNextAvail('none');
              }
            })
            .catch(() => {
              if (!cancelled) setNextAvail('none');
            });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setUnavailableSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId, date, totalMinutes]);

  const toggleService = (id: string): void => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStartAt(null);
  };

  const onPickBarber = (id: string): void => {
    setBarberId(id);
    setSelectedServices(new Set());
    setStartAt(null);
  };

  const onPickDate = (d: string): void => {
    setDate(d);
    setStartAt(null);
  };

  const canContinue =
    (step === 1 && !!barberId && selectedServices.size > 0) ||
    (step === 2 && startAt !== null) ||
    (step === 3 && !!barberId && selectedServices.size > 0 && startAt !== null);

  const goBack = (): void => {
    if (step > 1) {
      setStep((current) => current - 1);
      return;
    }
    navigation.goBack();
  };

  const goNext = (): void => {
    if (!canContinue) return;
    if (step < STEP_COUNT) {
      setStep((current) => current + 1);
      return;
    }
    void book();
  };

  const book = async (): Promise<void> => {
    if (!barberId || selectedServices.size === 0 || startAt === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const { appointmentId } = await api.createAppointment({
        barberId,
        serviceIds: Array.from(selectedServices),
        startAt,
      });
      navigation.replace('Confirmed', { appointmentId });
    } catch (err) {
      if (isBookingLimitError(err)) {
        setLimitReached(true);
      } else {
        setError(err instanceof Error ? err.message : t('couldNotCreateBooking'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const jumpToNextAvailable = (): void => {
    if (typeof nextAvail !== 'object' || nextAvail === null) return;
    setDate(nextAvail.date);
    setStartAt(nextAvail.slot);
    setStep(3);
  };

  const primaryTitle =
    step === 2 && startAt !== null
      ? t('reviewBooking', { time: formatTimeOfDay(startAt) })
      : step === 3
        ? t('confirmBooking')
        : t('continue');

  if (limitReached) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            gap: spacing.lg,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.pill,
              backgroundColor: colors.bgAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 44 }}>!</Text>
          </View>
          <Heading level={2} style={{ textAlign: 'center' }}>
            {t('bookingLimitTitle')}
          </Heading>
          <MutedText style={{ textAlign: 'center' }}>
            {t('bookingLimitBody', { max: MAX_DAILY_BOOKINGS_PER_CLIENT })}
          </MutedText>
        </View>
        <View style={{ paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Button
            title={t('viewMyBookings')}
            onPress={() => {
              setLimitReached(false);
              navigation.goBack();
            }}
          />
          <Button
            title={t('back')}
            variant="secondary"
            onPress={() => setLimitReached(false)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <StepHeader step={step} onBack={goBack} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <View style={{ gap: spacing.lg }}>
            <View>
              <Heading level={2}>{t('barberAndServices')}</Heading>
              <MutedText style={styles.subtitle}>{t('barberAndServicesHint')}</MutedText>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionLabel}>{t('barberSectionLabel')}</Text>
              {barbers.length === 0 ? (
                <MutedText>{t('noBarbersAvailable')}</MutedText>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {barbers.map((barber) => (
                    <BarberCard
                      key={barber.id}
                      barber={barber}
                      selected={barber.id === barberId}
                      onPress={() => onPickBarber(barber.id)}
                    />
                  ))}
                </View>
              )}
            </View>
            {barberId ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.sectionLabel}>{t('servicesSectionLabel')}</Text>
                {visibleServices.length === 0 ? (
                  <MutedText>{t('barberNoServices')}</MutedText>
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {visibleServices.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        selected={selectedServices.has(service.id)}
                        onPress={() => toggleService(service.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Heading level={2}>{t('dateAndTime')}</Heading>
            <MutedText style={styles.subtitle}>
              {dateAndTimeSubtitle(selectedBarber?.displayName, totalMinutes, t)}
            </MutedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.lg }}
              style={{ marginBottom: spacing.md }}
            >
              {dates.map((d) => {
                const { year, month, day } = parseDateString(d);
                const selected = d === date;
                return (
                  <Pressable
                    key={d}
                    onPress={() => onPickDate(d)}
                    style={[styles.dateCell, selected ? styles.dateCellSelected : null]}
                  >
                    <Text style={[styles.dateDow, selected ? styles.dateTextSelected : null]}>
                      {DOW_SHORT[dayOfWeekFromDateString(d)]}
                    </Text>
                    <Text style={[styles.dateDay, selected ? styles.dateTextSelected : null]}>
                      {day}
                    </Text>
                    <Text style={[styles.dateMonth, selected ? styles.dateTextSelected : null]}>
                      {formatDateShort(year, month, day).split(' ')[2]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {slots === null ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : slots.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
                <BodyText style={{ fontWeight: font.weight.semibold }}>{t('fullyBooked')}</BodyText>
                <MutedText style={{ textAlign: 'center' }}>
                  {t('fullyBookedBody', { barber: selectedBarber?.displayName ?? t('thisBarber'), date: dateLabel(date) })}
                </MutedText>
                {nextAvail === 'searching' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <ActivityIndicator color={colors.ink} />
                    <MutedText>{t('findingNextAvailable')}</MutedText>
                  </View>
                ) : nextAvail === 'none' ? (
                  <MutedText style={{ textAlign: 'center' }}>
                    {t('noAvailabilityInHorizon')}
                  </MutedText>
                ) : nextAvail && typeof nextAvail === 'object' ? (
                  <Button
                    title={t('jumpToNextAvailable', {
                      date: formatDateLong(nextAvail.slot),
                      time: formatTimeOfDay(nextAvail.slot),
                    })}
                    onPress={jumpToNextAvailable}
                  />
                ) : null}
              </Card>
            ) : (
              <View style={{ gap: spacing.xl }}>
                <TimeGroup
                  title={t('morning')}
                  slots={mergeSchedule(slots, unavailableSlots).filter(
                    (s) => hourOfSlot(s.startMs) < 12,
                  )}
                  startAt={startAt}
                  onPick={setStartAt}
                />
                <TimeGroup
                  title={t('afternoon')}
                  slots={mergeSchedule(slots, unavailableSlots).filter(
                    (s) => hourOfSlot(s.startMs) >= 12,
                  )}
                  startAt={startAt}
                  onPick={setStartAt}
                />
              </View>
            )}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Heading level={2}>{t('reviewAndConfirm')}</Heading>

            <Card style={styles.reviewBarberCard}>
              <BarberAvatar
                avatarUrl={selectedBarber?.avatarUrl ?? null}
                name={selectedBarber?.displayName ?? ''}
                size={48}
              />
              <View style={{ flex: 1 }}>
                <BodyText style={{ fontWeight: font.weight.semibold }}>
                  {selectedBarber?.displayName ?? '-'}
                </BodyText>
                <MutedText style={{ fontSize: font.size.sm, marginTop: 2 }}>
                  Rêve Hair Salon
                </MutedText>
              </View>
            </Card>

            <Card style={styles.reviewDetailsCard}>
              <View style={styles.reviewWhenRow}>
                <View style={styles.reviewWhenIcon}>
                  <Text style={styles.reviewWhenIconText}>·</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <BodyText style={{ fontWeight: font.weight.semibold }}>
                    {startAt !== null ? formatDateLong(startAt) : '-'}
                  </BodyText>
                  <MutedText style={{ fontSize: font.size.sm, marginTop: 2 }}>
                    {startAt !== null
                      ? `${formatTimeOfDay(startAt)} · ${formatDuration(totalMinutes)}`
                      : '-'}
                  </MutedText>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              {selectedServiceDocs.map((service) => (
                <View key={service.id} style={styles.reviewServiceRow}>
                  <MutedText>
                    {service.name} · {formatDuration(service.durationMinutes)}
                  </MutedText>
                  <BodyText style={{ fontWeight: font.weight.medium }}>
                    €{formatPrice(service.priceCents)}
                  </BodyText>
                </View>
              ))}
              <View style={styles.summaryDivider} />
              <View style={styles.reviewTotalRow}>
                <BodyText style={{ fontWeight: font.weight.semibold }}>{t('total')}</BodyText>
                <BodyText
                  style={{
                    fontWeight: font.weight.semibold,
                    fontSize: font.size.xl,
                  }}
                >
                  €{formatPrice(totalCents)}
                </BodyText>
              </View>
            </Card>

            <View style={styles.policyBanner}>
              <Text style={styles.policyIcon}>ⓘ</Text>
              <MutedText style={{ flex: 1, fontSize: font.size.xs, lineHeight: 18 }}>
                {t('payInSalonPolicy')}
              </MutedText>
            </View>

            {error ? <BodyText style={styles.errorText}>{error}</BodyText> : null}
          </View>
        ) : null}
      </ScrollView>

      <BottomBar>
        {step === 1 && selectedServices.size > 0 ? (
          <BottomSummary
            eyebrow={`${t('serviceCount', { count: selectedServices.size })} - ${formatDuration(totalMinutes || 0)} ${t('totalLabel')}`}
            label={t('subtotal')}
            value={`€${formatPrice(totalCents)}`}
          />
        ) : null}
        {step === 3 ? (
          <BottomSummary
            eyebrow={`${t('serviceCount', { count: selectedServices.size })} - ${formatDuration(totalMinutes || 0)}`}
            label={startAt !== null ? formatDateLong(startAt) : t('ready')}
            value={`€${formatPrice(totalCents)}`}
          />
        ) : null}
        <Button
          title={primaryTitle}
          loading={submitting}
          disabled={!canContinue || submitting}
          onPress={goNext}
        />
      </BottomBar>
    </Screen>
  );
}

interface StepHeaderProps {
  step: number;
  onBack: () => void;
}

function StepHeader({ step, onBack }: StepHeaderProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <IconButton label={t('back')} onPress={onBack}>
          <Text style={{ color: colors.ink, fontSize: 20, lineHeight: 24 }}>{'<'}</Text>
        </IconButton>
        <MutedText>{t('stepOf', { step, count: STEP_COUNT })}</MutedText>
      </View>
      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index < step ? styles.progressSegmentActive : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

interface BarberCardProps {
  barber: BarberDoc;
  selected: boolean;
  onPress: () => void;
}

function BarberCard({ barber, selected, onPress }: BarberCardProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.barberCard, selected ? styles.barberCardSelected : null]}
    >
      <BarberAvatar avatarUrl={barber.avatarUrl} name={barber.displayName} size={46} />
      <BodyText style={styles.barberCardName} numberOfLines={1}>
        {firstWord(barber.displayName)}
      </BodyText>
      {selected ? (
        <View style={styles.barberCardCheck}>
          <Text style={styles.barberCardCheckText}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function firstWord(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0]!;
}

interface ServiceRowProps {
  service: ServiceDoc;
  selected: boolean;
  onPress: () => void;
}

function ServiceRow({ service, selected, onPress }: ServiceRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.serviceRow, selected ? styles.selectedCard : null]}
    >
      <View style={[styles.checkbox, selected ? styles.checkboxSelected : null]}>
        {selected ? <Text style={styles.checkboxCheck}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <BodyText style={{ fontWeight: font.weight.semibold }}>{service.name}</BodyText>
        <MutedText style={{ fontSize: font.size.sm }}>
          {formatDuration(service.durationMinutes)}
        </MutedText>
      </View>
      <BodyText style={{ fontWeight: font.weight.semibold }}>
        €{formatPrice(service.priceCents)}
      </BodyText>
    </Pressable>
  );
}

interface ScheduleSlot {
  startMs: number;
  available: boolean;
}

interface TimeGroupProps {
  onPick: (slot: number) => void;
  slots: ScheduleSlot[];
  startAt: number | null;
  title: string;
}

function TimeGroup({ onPick, slots, startAt, title }: TimeGroupProps): React.JSX.Element | null {
  if (slots.length === 0) return null;

  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.timeGrid}>
        {slots.map(({ startMs, available }) => {
          const selected = startAt === startMs;
          return (
            <Pressable
              key={startMs}
              onPress={() => available && onPick(startMs)}
              disabled={!available}
              style={[
                styles.timeCell,
                selected ? styles.timeCellSelected : null,
                !available ? styles.timeCellDisabled : null,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  selected ? styles.timeTextSelected : null,
                  !available ? styles.timeTextDisabled : null,
                ]}
              >
                {formatTimeOfDay(startMs)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function mergeSchedule(available: number[], unavailable: number[]): ScheduleSlot[] {
  const merged: ScheduleSlot[] = [
    ...available.map((startMs) => ({ startMs, available: true })),
    ...unavailable.map((startMs) => ({ startMs, available: false })),
  ];
  merged.sort((a, b) => a.startMs - b.startMs);
  return merged;
}

interface SummaryLineProps {
  label: string;
  value: string;
  strong?: boolean;
}

function SummaryLine({ label, value, strong }: SummaryLineProps): React.JSX.Element {
  return (
    <View style={styles.summaryLine}>
      <MutedText>{label}</MutedText>
      <BodyText
        style={{
          flex: 1,
          textAlign: 'right',
          fontWeight: strong ? font.weight.semibold : font.weight.medium,
        }}
      >
        {value}
      </BodyText>
    </View>
  );
}

interface BottomSummaryProps {
  eyebrow: string;
  label: string;
  value: string;
}

function BottomSummary({ eyebrow, label, value }: BottomSummaryProps): React.JSX.Element {
  return (
    <View style={styles.bottomSummary}>
      <View>
        <MutedText style={{ fontSize: font.size.sm }}>{eyebrow}</MutedText>
        <MutedText style={{ fontSize: font.size.md }}>{label}</MutedText>
      </View>
      <Text style={styles.bottomValue}>{value}</Text>
    </View>
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

function dateLabel(date: string): string {
  const { year, month, day } = parseDateString(date);
  return formatDateShort(year, month, day);
}

function dateAndTimeSubtitle(
  barberName: string | undefined,
  totalMinutes: number,
  t: (key: TranslationKey, vars?: Record<string, number | string>) => string,
): string {
  const parts: string[] = [];
  if (barberName) parts.push(barberName);
  if (totalMinutes > 0) parts.push(`${totalMinutes} ${t('visit')}`);
  parts.push(t('upToDaysAhead', { days: DEFAULT_BOOKING_HORIZON_DAYS }));
  return parts.join(' · ');
}

function isBookingLimitError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { code?: string; message?: string };
  if (anyErr.code === 'functions/failed-precondition') {
    return /bookings? per day/i.test(anyErr.message ?? '');
  }
  return /bookings? per day/i.test(anyErr.message ?? '');
}

function hourOfSlot(slot: number): number {
  return parseInt(formatTimeOfDay(slot).slice(0, 2), 10);
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressSegmentActive: {
    backgroundColor: colors.accent,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.muted,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  barberCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    position: 'relative',
  },
  barberCardSelected: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  barberCardName: {
    fontSize: 13,
    fontWeight: font.weight.semibold,
    color: colors.ink,
    marginTop: 8,
    textAlign: 'center',
  },
  barberCardCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barberCardCheckText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: font.weight.semibold,
    lineHeight: 12,
  },
  selectedCard: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: '#ECECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.mutedSoft,
    fontWeight: font.weight.semibold,
    fontSize: font.size.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 5,
  },
  star: {
    color: colors.accent,
    fontSize: font.size.md,
    lineHeight: 16,
  },
  rating: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  radioCheck: {
    color: colors.card,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  serviceRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxCheck: {
    color: colors.card,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateCell: {
    width: 56,
    paddingVertical: 10,
    borderRadius: 13,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCellSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dateDow: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: font.weight.medium,
  },
  dateDay: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: font.weight.semibold,
    marginTop: 3,
  },
  dateMonth: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 1,
  },
  dateTextSelected: {
    color: colors.card,
  },
  loadingPanel: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.accent,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
  },
  timeCell: {
    width: '30.9%',
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCellSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  timeText: {
    color: colors.ink,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
  },
  timeTextSelected: {
    color: colors.card,
  },
  timeCellDisabled: {
    backgroundColor: colors.bgAlt,
    borderColor: colors.border,
  },
  timeTextDisabled: {
    color: colors.mutedSoft,
    fontWeight: font.weight.medium,
    textDecorationLine: 'line-through',
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  bottomSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bottomValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: font.weight.semibold,
  },
  errorText: {
    marginTop: spacing.lg,
    color: colors.danger,
  },
  reviewBarberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: spacing.lg,
  },
  reviewDetailsCard: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  reviewWhenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewWhenIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 140, 19, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewWhenIconText: {
    color: colors.accent,
    fontWeight: font.weight.semibold,
    fontSize: 18,
    lineHeight: 22,
  },
  reviewServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  policyBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.bgAlt,
    borderRadius: 12,
    padding: 12,
    marginTop: spacing.md,
  },
  policyIcon: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 20,
    marginTop: 1,
  },
});
