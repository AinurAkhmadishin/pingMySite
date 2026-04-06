import { User } from "@prisma/client";
import { Context } from "telegraf";

import { JsonRule } from "../modules/checks/types";

export interface AddMonitorDraft {
  url?: string;
  name?: string;
  intervalMinutes?: number;
  requiredText?: string | null;
  checkSsl: boolean;
  checkJson: boolean;
  jsonRules?: JsonRule[] | null;
  failureThreshold: number;
}

export interface AddMonitorFlow {
  kind: "add";
  step:
    | "url"
    | "name"
    | "interval"
    | "contentToggle"
    | "contentText"
    | "sslToggle"
    | "jsonToggle"
    | "jsonRules"
    | "sensitivity";
  draft: AddMonitorDraft;
}

export interface SettingsFlow {
  kind: "settings";
  monitorId: string;
  field: "timeout" | "requiredText" | "jsonRules";
}

export type BotFlow = AddMonitorFlow | SettingsFlow;

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
