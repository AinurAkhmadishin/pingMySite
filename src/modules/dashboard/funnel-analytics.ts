import { FunnelSessionStatus, Prisma, SubscriptionCheckoutStatus } from "@prisma/client";

import { ADD_MONITOR_FUNNEL_STEPS } from "../funnels/funnel.constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALLED_AFTER_MINUTES = 60;

type DashboardUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  timezone: string;
};

export interface DashboardFunnelStage {
  key: string;
  label: string;
  reachedSessions: number;
  conversionFromStartPercent: number;
}

export interface DashboardFunnelStepStat {
  key: string;
  label: string;
  reachedSessions: number;
  conversionFromStartPercent: number;
  activeSessions: number;
  abandonedSessions: number;
  stoppedSessions: number;
  completedSessions: number;
}

export interface DashboardFunnelTimelinePoint {
  date: string;
  startedSessions: number;
  checkoutSessions: number;
  paidSessions: number;
  createdMonitors: number;
  droppedSessions: number;
}

export interface DashboardFunnelRecentSession {
  id: string;
  user: DashboardUser;
  status: FunnelSessionStatus;
  pathKind: "TRIAL" | "SUBSCRIPTION" | "UNKNOWN";
  paymentState: "NONE" | "TRIAL" | "CHECKOUT" | "PRECHECKOUT" | "PAID";
  currentStepKey: string;
  currentStepLabel: string;
  eventCount: number;
  startedAt: Date;
  lastEventAt: Date;
  completedAt: Date | null;
  durationMinutes: number;
  checkoutStatus: SubscriptionCheckoutStatus | null;
  monitorCreated: boolean;
  lastEventPayload: Prisma.JsonValue | null;
}

export interface DashboardFunnelAnalytics {
  generatedAt: Date;
  windowDays: number;
  stalledAfterMinutes: number;
  summary: {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    stoppedSessions: number;
    abandonedSessions: number;
    stalledSessions: number;
    trialSelections: number;
    subscriptionSelections: number;
    checkoutOpenedSessions: number;
    paidSessions: number;
    monitorCreatedSessions: number;
    conversionToCheckoutPercent: number;
    conversionToPaymentPercent: number;
    conversionToMonitorCreatedPercent: number;
    averageCompletionMinutes: number | null;
  };
  stages: DashboardFunnelStage[];
  steps: DashboardFunnelStepStat[];
  timeline: DashboardFunnelTimelinePoint[];
  recentSessions: DashboardFunnelRecentSession[];
}

export type DashboardFunnelSessionRecord = {
  id: string;
  status: FunnelSessionStatus;
  currentStepKey: string;
  currentStepLabel: string;
  startedAt: Date;
  lastEventAt: Date;
  completedAt: Date | null;
  lastEventPayload: Prisma.JsonValue | null;
  user: DashboardUser;
  events: Array<{
    stepKey: string;
    stepLabel: string;
    createdAt: Date;
  }>;
  checkouts: Array<{
    status: SubscriptionCheckoutStatus;
  }>;
};

const STEP_DEFINITIONS = [
  ADD_MONITOR_FUNNEL_STEPS.awaitingUrl,
  ADD_MONITOR_FUNNEL_STEPS.invalidUrl,
  ADD_MONITOR_FUNNEL_STEPS.duplicateUrlBlocked,
  ADD_MONITOR_FUNNEL_STEPS.awaitingName,
  ADD_MONITOR_FUNNEL_STEPS.awaitingInterval,
  ADD_MONITOR_FUNNEL_STEPS.awaitingContentToggle,
  ADD_MONITOR_FUNNEL_STEPS.awaitingContentText,
  ADD_MONITOR_FUNNEL_STEPS.awaitingSslToggle,
  ADD_MONITOR_FUNNEL_STEPS.awaitingJsonToggle,
  ADD_MONITOR_FUNNEL_STEPS.awaitingJsonRules,
  ADD_MONITOR_FUNNEL_STEPS.invalidJsonRules,
  ADD_MONITOR_FUNNEL_STEPS.awaitingSensitivity,
  ADD_MONITOR_FUNNEL_STEPS.awaitingTermSelection,
  ADD_MONITOR_FUNNEL_STEPS.trialSelected,
  ADD_MONITOR_FUNNEL_STEPS.subscriptionSelected,
  ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment,
  ADD_MONITOR_FUNNEL_STEPS.subscriptionPreCheckoutApproved,
  ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded,
  ADD_MONITOR_FUNNEL_STEPS.monitorCreationFailed,
  ADD_MONITOR_FUNNEL_STEPS.monitorCreated,
];

const STAGE_DEFINITIONS = [
  {
    key: "started",
    label: "Старт опроса",
    matches: () => true,
  },
  {
    key: "questionnaire_completed",
    label: "Дошли до выбора тарифа",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.awaitingTermSelection.key),
  },
  {
    key: "trial_selected",
    label: "Выбран trial",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.trialSelected.key),
  },
  {
    key: "checkout_opened",
    label: "Открыт checkout",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key),
  },
  {
    key: "precheckout_approved",
    label: "Pre-checkout подтвержден",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPreCheckoutApproved.key),
  },
  {
    key: "payment_succeeded",
    label: "Оплата прошла",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded.key),
  },
  {
    key: "monitor_created",
    label: "Монитор создан",
    matches: (steps: Set<string>) => steps.has(ADD_MONITOR_FUNNEL_STEPS.monitorCreated.key),
  },
];

function toPercent(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildTimeline(windowDays: number, now: Date): Map<string, DashboardFunnelTimelinePoint> {
  const points = new Map<string, DashboardFunnelTimelinePoint>();
  const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const current = new Date(endUtc - offset * DAY_MS);
    const key = toDayKey(current);

    points.set(key, {
      date: key,
      startedSessions: 0,
      checkoutSessions: 0,
      paidSessions: 0,
      createdMonitors: 0,
      droppedSessions: 0,
    });
  }

  return points;
}

function incrementTimeline(
  timeline: Map<string, DashboardFunnelTimelinePoint>,
  date: Date | undefined | null,
  field: keyof Omit<DashboardFunnelTimelinePoint, "date">,
): void {
  if (!date) {
    return;
  }

  const point = timeline.get(toDayKey(date));

  if (!point) {
    return;
  }

  point[field] += 1;
}

function resolvePathKind(stepKeys: Set<string>): "TRIAL" | "SUBSCRIPTION" | "UNKNOWN" {
  if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.trialSelected.key)) {
    return "TRIAL";
  }

  if (
    stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionSelected.key) ||
    stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key) ||
    stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded.key)
  ) {
    return "SUBSCRIPTION";
  }

  return "UNKNOWN";
}

function resolvePaymentState(
  pathKind: "TRIAL" | "SUBSCRIPTION" | "UNKNOWN",
  stepKeys: Set<string>,
): "NONE" | "TRIAL" | "CHECKOUT" | "PRECHECKOUT" | "PAID" {
  if (pathKind === "TRIAL") {
    return "TRIAL";
  }

  if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded.key)) {
    return "PAID";
  }

  if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPreCheckoutApproved.key)) {
    return "PRECHECKOUT";
  }

  if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key)) {
    return "CHECKOUT";
  }

  return "NONE";
}

export function buildFunnelAnalytics(
  sessions: DashboardFunnelSessionRecord[],
  now: Date,
  windowDays: number,
): DashboardFunnelAnalytics {
  const totalSessions = sessions.length;
  const stalledBefore = new Date(now.getTime() - DEFAULT_STALLED_AFTER_MINUTES * 60 * 1000);
  const timeline = buildTimeline(windowDays, now);

  const stepStats = new Map<string, DashboardFunnelStepStat>(
    STEP_DEFINITIONS.map((step) => [
      step.key,
      {
        key: step.key,
        label: step.label,
        reachedSessions: 0,
        conversionFromStartPercent: 0,
        activeSessions: 0,
        abandonedSessions: 0,
        stoppedSessions: 0,
        completedSessions: 0,
      } satisfies DashboardFunnelStepStat,
    ]),
  );

  let activeSessions = 0;
  let completedSessions = 0;
  let stoppedSessions = 0;
  let abandonedSessions = 0;
  let stalledSessions = 0;
  let trialSelections = 0;
  let subscriptionSelections = 0;
  let checkoutOpenedSessions = 0;
  let paidSessions = 0;
  let monitorCreatedSessions = 0;
  let totalCompletionMinutes = 0;
  let completionCount = 0;

  const recentSessions: DashboardFunnelRecentSession[] = [];

  for (const session of sessions) {
    const stepKeys = new Set<string>();
    const firstStepAt = new Map<string, Date>();

    for (const event of session.events) {
      if (!stepKeys.has(event.stepKey)) {
        stepKeys.add(event.stepKey);
        firstStepAt.set(event.stepKey, event.createdAt);
      }
    }

    if (!stepKeys.has(session.currentStepKey)) {
      stepKeys.add(session.currentStepKey);
      firstStepAt.set(session.currentStepKey, session.lastEventAt);
    }

    for (const stepKey of stepKeys) {
      const stat = stepStats.get(stepKey);

      if (stat) {
        stat.reachedSessions += 1;
      }
    }

    const currentStepStat = stepStats.get(session.currentStepKey);
    if (currentStepStat) {
      if (session.status === FunnelSessionStatus.ACTIVE) {
        currentStepStat.activeSessions += 1;
      } else if (session.status === FunnelSessionStatus.ABANDONED) {
        currentStepStat.abandonedSessions += 1;
      } else if (session.status === FunnelSessionStatus.STOPPED) {
        currentStepStat.stoppedSessions += 1;
      } else if (session.status === FunnelSessionStatus.COMPLETED) {
        currentStepStat.completedSessions += 1;
      }
    }

    if (session.status === FunnelSessionStatus.ACTIVE) {
      activeSessions += 1;

      if (session.lastEventAt <= stalledBefore) {
        stalledSessions += 1;
      }
    } else if (session.status === FunnelSessionStatus.COMPLETED) {
      completedSessions += 1;
    } else if (session.status === FunnelSessionStatus.STOPPED) {
      stoppedSessions += 1;
    } else if (session.status === FunnelSessionStatus.ABANDONED) {
      abandonedSessions += 1;
    }

    if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.trialSelected.key)) {
      trialSelections += 1;
    }

    if (
      stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionSelected.key) ||
      stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key)
    ) {
      subscriptionSelections += 1;
    }

    if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key)) {
      checkoutOpenedSessions += 1;
    }

    if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded.key)) {
      paidSessions += 1;
    }

    if (stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.monitorCreated.key)) {
      monitorCreatedSessions += 1;
    }

    if (session.completedAt && stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.monitorCreated.key)) {
      totalCompletionMinutes += Math.max(0, Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 60000));
      completionCount += 1;
    }

    incrementTimeline(timeline, session.startedAt, "startedSessions");
    incrementTimeline(timeline, firstStepAt.get(ADD_MONITOR_FUNNEL_STEPS.awaitingSubscriptionPayment.key), "checkoutSessions");
    incrementTimeline(timeline, firstStepAt.get(ADD_MONITOR_FUNNEL_STEPS.subscriptionPaymentSucceeded.key), "paidSessions");
    incrementTimeline(timeline, firstStepAt.get(ADD_MONITOR_FUNNEL_STEPS.monitorCreated.key), "createdMonitors");

    if (session.status === FunnelSessionStatus.ABANDONED || session.status === FunnelSessionStatus.STOPPED) {
      incrementTimeline(timeline, session.completedAt ?? session.lastEventAt, "droppedSessions");
    }

    const pathKind = resolvePathKind(stepKeys);
    const paymentState = resolvePaymentState(pathKind, stepKeys);
    const checkout = session.checkouts[0] ?? null;

    recentSessions.push({
      id: session.id,
      user: session.user,
      status: session.status,
      pathKind,
      paymentState,
      currentStepKey: session.currentStepKey,
      currentStepLabel: session.currentStepLabel,
      eventCount: session.events.length,
      startedAt: session.startedAt,
      lastEventAt: session.lastEventAt,
      completedAt: session.completedAt,
      durationMinutes: Math.max(
        0,
        Math.round(((session.completedAt ?? session.lastEventAt).getTime() - session.startedAt.getTime()) / 60000),
      ),
      checkoutStatus: checkout?.status ?? null,
      monitorCreated: stepKeys.has(ADD_MONITOR_FUNNEL_STEPS.monitorCreated.key),
      lastEventPayload: session.lastEventPayload,
    });
  }

  for (const stat of stepStats.values()) {
    stat.conversionFromStartPercent = toPercent(stat.reachedSessions, totalSessions);
  }

  const stages = STAGE_DEFINITIONS.map((stage) => {
    const reachedSessions = sessions.filter((session) => {
      const stepKeys = new Set(session.events.map((event) => event.stepKey));
      stepKeys.add(session.currentStepKey);
      return stage.matches(stepKeys);
    }).length;

    return {
      key: stage.key,
      label: stage.label,
      reachedSessions,
      conversionFromStartPercent: toPercent(reachedSessions, totalSessions),
    } satisfies DashboardFunnelStage;
  });

  recentSessions.sort((left, right) => right.lastEventAt.getTime() - left.lastEventAt.getTime());

  return {
    generatedAt: now,
    windowDays,
    stalledAfterMinutes: DEFAULT_STALLED_AFTER_MINUTES,
    summary: {
      totalSessions,
      activeSessions,
      completedSessions,
      stoppedSessions,
      abandonedSessions,
      stalledSessions,
      trialSelections,
      subscriptionSelections,
      checkoutOpenedSessions,
      paidSessions,
      monitorCreatedSessions,
      conversionToCheckoutPercent: toPercent(checkoutOpenedSessions, totalSessions),
      conversionToPaymentPercent: toPercent(paidSessions, totalSessions),
      conversionToMonitorCreatedPercent: toPercent(monitorCreatedSessions, totalSessions),
      averageCompletionMinutes: completionCount === 0 ? null : Number((totalCompletionMinutes / completionCount).toFixed(1)),
    },
    stages,
    steps: Array.from(stepStats.values()).filter((step) => step.reachedSessions > 0),
    timeline: Array.from(timeline.values()),
    recentSessions: recentSessions.slice(0, 12),
  };
}
