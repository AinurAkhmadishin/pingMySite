import { Telegram } from "telegraf";

import { prisma } from "../db/prisma";
import { HttpChecker } from "../modules/checks/http-checker";
import { IncidentRepository } from "../modules/incidents/incident.repository";
import { IncidentService } from "../modules/incidents/incident.service";
import { MonitorCheckService } from "../modules/monitors/monitor-check.service";
import { MonitorRepository } from "../modules/monitors/monitor.repository";
import { MonitorService } from "../modules/monitors/monitor.service";
import { NotificationService } from "../modules/notifications/notification.service";
import { ReportService } from "../modules/reports/report.service";
import { SummaryService } from "../modules/reports/summary.service";
import { SslService } from "../modules/ssl/ssl.service";
import { UserRepository } from "../modules/users/user.repository";
import { UserService } from "../modules/users/user.service";
import { createRedisConnection } from "../queue/connection";
import { QueueManager } from "../queue/queues";
import { env } from "../config/env";

export interface AppServices {
  prisma: typeof prisma;
  redis: ReturnType<typeof createRedisConnection>;
  queueManager: QueueManager;
  userService: UserService;
  monitorService: MonitorService;
  monitorCheckService: MonitorCheckService;
  incidentService: IncidentService;
  reportService: ReportService;
  summaryService: SummaryService;
  sslService: SslService;
  notificationService: NotificationService;
}

export function createAppServices(): AppServices {
  const redis = createRedisConnection();
  const queueManager = new QueueManager(redis);
  const userRepository = new UserRepository(prisma);
  const monitorRepository = new MonitorRepository(prisma);
  const incidentRepository = new IncidentRepository(prisma);
  const userService = new UserService(userRepository);
  const telegram = new Telegram(env.BOT_TOKEN);
  const notificationService = new NotificationService(prisma, telegram);
  const reportService = new ReportService(prisma, monitorRepository, incidentRepository);
  const summaryService = new SummaryService(userService, reportService, notificationService);
  const sslService = new SslService(prisma, monitorRepository, notificationService);
  const incidentService = new IncidentService(incidentRepository, monitorRepository, notificationService);
  const monitorCheckService = new MonitorCheckService(
    monitorRepository,
    new HttpChecker(),
    queueManager,
    queueManager,
    redis,
  );
  const monitorService = new MonitorService(monitorRepository, queueManager);

  return {
    prisma,
    redis,
    queueManager,
    userService,
    monitorService,
    monitorCheckService,
    incidentService,
    reportService,
    summaryService,
    sslService,
    notificationService,
  };
}
