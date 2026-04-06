import { JsonRule } from "./types";

export interface JsonValidationResult {
  matched: boolean;
  reason?: string;
}

function parseLiteral(raw: string): string | number | boolean | null {
  const trimmed = raw.trim();

  if (trimmed === "null") {
    return null;
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") {
    return Number(trimmed);
  }

  return trimmed.replace(/^"(.*)"$/, "$1");
}

export function parseJsonRulesText(input: string): JsonRule[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.endsWith(" exists")) {
        return {
          path: line.replace(/\s+exists$/, "").trim(),
          operator: "exists" as const,
        };
      }

      const equalsMatch = line.match(/^(.+?)\s*=\s*(.+)$/);

      if (!equalsMatch) {
        throw new Error(`Не удалось распознать правило: ${line}`);
      }

      return {
        path: equalsMatch[1].trim(),
        operator: "equals" as const,
        value: parseLiteral(equalsMatch[2].trim()),
      };
    });
}

export function getValueByPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return Reflect.get(current, segment);
    }

    return undefined;
  }, payload);
}

export function validateJsonPayload(payload: unknown, rules?: JsonRule[] | null): JsonValidationResult {
  if (!rules || rules.length === 0) {
    return {
      matched: true,
    };
  }

  for (const rule of rules) {
    const value = getValueByPath(payload, rule.path);

    if (rule.operator === "exists" && value === undefined) {
      return {
        matched: false,
        reason: `JSON-путь "${rule.path}" не найден`,
      };
    }

    if (rule.operator === "equals" && value !== rule.value) {
      return {
        matched: false,
        reason: `Значение "${rule.path}" не совпало с ожидаемым`,
      };
    }
  }

  return {
    matched: true,
  };
}
