import { Telegram } from "telegraf";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { createRedisConnection } from "../queue/connection";
import { QueueManager } from "../queue/queues";
import { HttpChecker } from "../modules/checks/http-checker";
import { DashboardService } from "../modules/dashboard/dashboard.service";
import { FunnelRepository } from "../modules/funnels/funnel.repository";
import { FunnelService } from "../modules/funnels/funnel.service";
import { IncidentRepository } from "../modules/incidents/incident.repository";
import { IncidentService } from "../modules/incidents/incident.service";
import { MonitorCheckService } from "../modules/monitors/monitor-check.service";
import { MonitorHealthService } from "../modules/monitors/monitor-health.service";
import { MonitorRepository } from "../modules/monitors/monitor.repository";
import { MonitorService } from "../modules/monitors/monitor.service";
import { AccessReminderService } from "../modules/notifications/access-reminder.service";
import { NotificationService } from "../modules/notifications/notification.service";
import { ReportService } from "../modules/reports/report.service";
import { SummaryService } from "../modules/reports/summary.service";
import { SslService } from "../modules/ssl/ssl.service";
import { AdminAlertService } from "../modules/system/admin-alert.service";
import { WorkerHealthService } from "../modules/system/worker-health.service";
import { SubscriptionRepository } from "../modules/subscriptions/subscription.repository";
import { SubscriptionService } from "../modules/subscriptions/subscription.service";
import { UserRepository } from "../modules/users/user.repository";
import { UserService } from "../modules/users/user.service";

export interface AppServices {
  prisma: typeof prisma;
  redis: ReturnType<typeof createRedisConnection>;
  queueManager: QueueManager;
  userService: UserService;
  dashboardService: DashboardService;
  funnelService: FunnelService;
  monitorService: MonitorService;
  monitorCheckService: MonitorCheckService;
  monitorHealthService: MonitorHealthService;
  incidentService: IncidentService;
  reportService: ReportService;
  summaryService: SummaryService;
  sslService: SslService;
  notificationService: NotificationService;
  accessReminderService: AccessReminderService;
  adminAlertService: AdminAlertService;
  workerHealthService: WorkerHealthService;
  subscriptionService: SubscriptionService;
}

export function createAppServices(): AppServices {
  const redis = createRedisConnection();
  const queueManager = new QueueManager(redis);
  const userRepository = new UserRepository(prisma);
  const monitorRepository = new MonitorRepository(prisma);
  const incidentRepository = new IncidentRepository(prisma);
  const funnelRepository = new FunnelRepository(prisma);
  const subscriptionRepository = new SubscriptionRepository(prisma);
  const userService = new UserService(userRepository);
  const funnelService = new FunnelService(funnelRepository);
  const telegram = new Telegram(env.BOT_TOKEN);
  const subscriptionService = new SubscriptionService(
    subscriptionRepository,
    monitorRepository,
    queueManager,
    telegram,
    funnelService,
  );
  const notificationService = new NotificationService(prisma, telegram);
  const accessReminderService = new AccessReminderService(prisma, notificationService);
  const reportService = new ReportService(prisma, monitorRepository, incidentRepository);
  const summaryService = new SummaryService(userService, reportService, notificationService);
  const sslService = new SslService(prisma, monitorRepository, notificationService);
  const incidentService = new IncidentService(incidentRepository, monitorRepository, notificationService);
  const monitorHealthService = new MonitorHealthService(prisma);
  const workerHealthService = new WorkerHealthService(redis);
  const adminAlertService = new AdminAlertService(notificationService, workerHealthService, monitorHealthService);
  const dashboardService = new DashboardService(prisma, workerHealthService, monitorHealthService);
  const monitorCheckService = new MonitorCheckService(
    monitorRepository,
    new HttpChecker(),
    queueManager,
    queueManager,
    redis,
  );
  const monitorService = new MonitorService(monitorRepository, queueManager, subscriptionService);

  return {
    prisma,
    redis,
    queueManager,
    userService,
    dashboardService,
    funnelService,
    monitorService,
    monitorCheckService,
    monitorHealthService,
    incidentService,
    reportService,
    summaryService,
    sslService,
    notificationService,
    accessReminderService,
    adminAlertService,
    workerHealthService,
    subscriptionService,
  };
}
