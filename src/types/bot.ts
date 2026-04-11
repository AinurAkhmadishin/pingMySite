import { User } from "@prisma/client";
import { Context } from "telegraf";

import { AddMonitorPresetKey, MonitorTermKey } from "../config/constants";
import { JsonRule } from "../modules/checks/types";

export interface AddMonitorDraft {
  presetKey?: AddMonitorPresetKey;
  url?: string;
  name?: string;
  intervalMinutes?: number;
  termKey?: MonitorTermKey;
  requiredText?: string | null;
  checkSsl: boolean;
  checkJson: boolean;
  jsonRules?: JsonRule[] | null;
  failureThreshold: number;
}

export interface AddMonitorFlow {
  kind: "add";
  funnelSessionId: string;
  step:
    | "preset"
    | "url"
    | "name"
    | "interval"
    | "contentToggle"
    | "contentText"
    | "sslToggle"
    | "jsonToggle"
    | "jsonRules"
    | "sensitivity"
    | "duration";
  draft: AddMonitorDraft;
}

export interface SettingsFlow {
  kind: "settings";
  monitorId: string;
  field: "requiredText" | "jsonRules";
}

export interface NotificationSettingsFlow {
  kind: "notification-settings";
  field: "dailySummaryTime";
}

export type BotFlow = AddMonitorFlow | SettingsFlow | NotificationSettingsFlow;

export interface BotSession {
  flow?: BotFlow;
}

export interface BotState {
  currentUser?: User;
}

export interface BotContext extends Context {
  session: BotSession;
  state: BotState;
}
