import { z } from "zod";

import {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
  SUPPORTED_INTERVALS,
} from "../../config/constants";
import { sanitizeText } from "../../lib/url";

export const jsonRuleSchema = z
  .object({
    path: z.string().min(1),
    operator: z.enum(["exists", "equals"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  })
  .superRefine((value, context) => {
    if (value.operator === "equals" && value.value === undefined) {
      context.addIssue({
        code: "custom",
        message: "Для правила equals требуется value.",
      });
    }
  });

export const jsonRulesSchema = z.array(jsonRuleSchema);

export const createMonitorSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(100).transform((value) => sanitizeText(value, 100)),
  url: z.string().min(3),
  termKind: z.enum(["TRIAL", "SUBSCRIPTION"]).default("TRIAL"),
  intervalMinutes: z
    .union([
      z.enum(SUPPORTED_INTERVALS.map(String) as [string, ...string[]]).transform(Number),
      z.number().int(),
    ])
    .refine((value) => SUPPORTED_INTERVALS.includes(value as (typeof SUPPORTED_INTERVALS)[number]), {
      message: "Интервал должен быть одним из поддерживаемых значений.",
    }),
  timeoutMs: z.number().int().min(1000).max(30000).default(5000),
  requiredText: z
    .string()
    .trim()
    .max(500)
    .transform((value) => sanitizeText(value, 500))
    .optional()
    .nullable(),
  checkSsl: z.boolean().default(false),
  checkJson: z.boolean().default(false),
  jsonRules: jsonRulesSchema.optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  failureThreshold: z.number().int().min(2).max(5).default(DEFAULT_FAILURE_THRESHOLD),
  recoveryThreshold: z.number().int().min(1).max(3).default(DEFAULT_RECOVERY_THRESHOLD),
});

export const updateMonitorSettingsSchema = z.object({
  intervalMinutes: z.number().int().min(1).max(15).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  requiredText: z.string().max(500).nullable().optional(),
  checkSsl: z.boolean().optional(),
  checkJson: z.boolean().optional(),
  jsonRules: jsonRulesSchema.nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  failureThreshold: z.number().int().min(2).max(5).optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorSettingsInput = z.infer<typeof updateMonitorSettingsSchema>;
