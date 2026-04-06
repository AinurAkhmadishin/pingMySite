export type JsonRuleOperator = "exists" | "equals";

export interface JsonRule {
  path: string;
  operator: JsonRuleOperator;
  value?: string | number | boolean | null;
}

export interface MonitorCheckExecutionInput {
  url: string;
  timeoutMs: number;
  requiredText?: string | null;
  checkJson: boolean;
  jsonRules?: JsonRule[] | null;
}

export interface MonitorCheckExecutionResult {
  success: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  errorMessage?: string;
  contentMatched?: boolean;
  jsonMatched?: boolean;
  checkedAt: Date;
}
