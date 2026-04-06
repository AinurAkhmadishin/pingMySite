import tls from "node:tls";

import { PrismaClient } from "@prisma/client";

import { SSL_ALERT_THRESHOLDS } from "../../config/constants";
import { daysUntil } from "../../lib/date-time";
import { isHttpsUrl } from "../../lib/url";
import { MonitorRepository } from "../monitors/monitor.repository";
import { NotificationService } from "../notifications/notification.service";

function selectThreshold(daysLeft: number): number | null {
  const applicableThresholds = [...SSL_ALERT_THRESHOLDS]
    .filter((threshold) => daysLeft <= threshold)
    .sort((left, right) => left - right);

  return applicableThresholds[0] ?? null;
}

export class SslService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly monitorRepository: MonitorRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async fetchCertificateExpiration(url: string, timeoutMs: number): Promise<Date> {
    if (!isHttpsUrl(url)) {
      throw new Error("SSL check поддерживается только для HTTPS URL.");
    }

    const parsedUrl = new URL(url);

    return new Promise<Date>((resolve, reject) => {
      const socket = tls.connect(
        {
          host: parsedUrl.hostname,
          port: parsedUrl.port ? Number(parsedUrl.port) : 443,
          servername: parsedUrl.hostname,
          rejectUnauthorized: false,
          timeout: timeoutMs,
        },
        () => {
          const certificate = socket.getPeerCertificate();

          if (!certificate || typeof certificate.valid_to !== "string") {
            socket.end();
            reject(new Error("Не удалось получить данные SSL-сертификата."));
            return;
          }

          socket.end();
          resolve(new Date(certificate.valid_to));
        },
      );

      socket.once("error", (error) => {
        reject(error);
      });

      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error(`Таймаут SSL-проверки после ${timeoutMs}ms`));
      });
    });
  }

  async checkMonitorSsl(monitorId: string): Promise<void> {
    const monitor = await this.monitorRepository.findByIdWithUser(monitorId);

    if (!monitor || monitor.deletedAt || !monitor.checkSsl || !isHttpsUrl(monitor.url)) {
      return;
    }

    const expiresAt = await this.fetchCertificateExpiration(monitor.url, monitor.timeoutMs);
    const daysLeft = daysUntil(expiresAt);
    const thresholdDays = selectThreshold(daysLeft);

    if (!thresholdDays) {
      return;
    }

    const existingLog = await this.prisma.sslAlertLog.findUnique({
      where: {
        monitorId_thresholdDays_expiresAt: {
          monitorId: monitor.id,
          thresholdDays,
          expiresAt,
        },
      },
    });

    if (existingLog) {
      return;
    }

    await this.notificationService.sendSslExpiringAlert(monitor, {
      expiresAt,
      daysLeft,
      thresholdDays,
    });

    await this.prisma.sslAlertLog.create({
      data: {
        monitorId: monitor.id,
        thresholdDays,
        expiresAt,
      },
    });
  }
}
