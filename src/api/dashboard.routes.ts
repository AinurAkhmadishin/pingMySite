import { MonitorState } from "@prisma/client";
import express from "express";

import { AppServices } from "../app/services";
import { toErrorMessage } from "../lib/http";

function resolveStateFilter(value: unknown): MonitorState | "ALL" {
  if (typeof value !== "string") {
    return "ALL";
  }

  const normalized = value.toUpperCase();

  if (
    normalized === MonitorState.UP ||
    normalized === MonitorState.DOWN ||
    normalized === MonitorState.UNKNOWN ||
    normalized === MonitorState.PAUSED
  ) {
    return normalized;
  }

  return "ALL";
}

function resolveWindowDays(value: unknown): number {
  if (typeof value !== "string") {
    return 30;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 90);
}

export function createDashboardRouter(services: AppServices): express.Router {
  const router = express.Router();

  router.get("/overview", async (_req, res) => {
    try {
      const overview = await services.dashboardService.getOverview();
      res.json(overview);
    } catch (error) {
      res.status(500).json({
        error: toErrorMessage(error),
      });
    }
  });

  router.get("/monitors", async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const state = resolveStateFilter(req.query.state);
      const monitors = await services.dashboardService.listMonitors({
        search,
        state,
      });

      res.json({
        items: monitors,
        total: monitors.length,
      });
    } catch (error) {
      res.status(500).json({
        error: toErrorMessage(error),
      });
    }
  });

  router.get("/monitors/:monitorId", async (req, res) => {
    try {
      const details = await services.dashboardService.getMonitorDetails(req.params.monitorId);

      if (!details) {
        res.status(404).json({
          error: "Monitor not found.",
        });
        return;
      }

      res.json(details);
    } catch (error) {
      res.status(500).json({
        error: toErrorMessage(error),
      });
    }
  });

  router.get("/funnel", async (req, res) => {
    try {
      const days = resolveWindowDays(req.query.days);
      const analytics = await services.dashboardService.getFunnelAnalytics(days);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({
        error: toErrorMessage(error),
      });
    }
  });

  return router;
}
