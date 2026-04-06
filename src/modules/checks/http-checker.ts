import { request } from "undici";

import { env } from "../../config/env";
import { isRetryableNetworkError, sleep, toErrorMessage } from "../../lib/http";
import { validateRequiredText } from "./content-validator";
import { validateJsonPayload } from "./json-validator";
import { MonitorCheckExecutionInput, MonitorCheckExecutionResult } from "./types";

async function readBody(body: AsyncIterable<Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of body) {
    totalSize += chunk.length;

    if (totalSize > env.MAX_RESPONSE_BODY_BYTES) {
      throw new Error(`Ответ превысил лимит ${env.MAX_RESPONSE_BODY_BYTES} байт`);
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function buildNetworkErrorMessage(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) {
    return "Неизвестная ошибка сети";
  }

  const code = Reflect.get(error, "code");

  if (code === "ENOTFOUND") {
    return "DNS-ошибка: домен не найден";
  }

  if (code === "ECONNREFUSED") {
    return "Соединение отклонено";
  }

  if (code === "ECONNRESET") {
    return "Соединение было сброшено";
  }

  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT") {
    return `Таймаут после ${timeoutMs}ms`;
  }

  if (String(code).includes("TLS")) {
    return "TLS-ошибка при установке соединения";
  }

  return toErrorMessage(error);
}

export class HttpChecker {
  async execute(input: MonitorCheckExecutionInput): Promise<MonitorCheckExecutionResult> {
    let attempt = 0;

    while (true) {
      try {
        const startedAt = performance.now();
        const response = await request(input.url, {
          method: "GET",
          maxRedirections: env.MAX_REDIRECTS,
          headersTimeout: input.timeoutMs,
          bodyTimeout: input.timeoutMs,
          headers: {
            "user-agent": env.MONITOR_USER_AGENT,
            accept: "*/*",
          },
        });

        const body = await readBody(response.body);
        const responseTimeMs = Math.round(performance.now() - startedAt);
        const checkedAt = new Date();

        if (response.statusCode < 200 || response.statusCode >= 400) {
          return {
            success: false,
            statusCode: response.statusCode,
            responseTimeMs,
            errorMessage: `HTTP ${response.statusCode}`,
            checkedAt,
          };
        }

        const contentValidation = validateRequiredText(body, input.requiredText);
        if (!contentValidation.matched) {
          return {
            success: false,
            statusCode: response.statusCode,
            responseTimeMs,
            errorMessage: contentValidation.reason,
            contentMatched: false,
            checkedAt,
          };
        }

        if (input.checkJson) {
          let payload: unknown;

          try {
            payload = JSON.parse(body);
          } catch (error) {
            return {
              success: false,
              statusCode: response.statusCode,
              responseTimeMs,
              errorMessage: `Невалидный JSON: ${toErrorMessage(error)}`,
              contentMatched: input.requiredText ? true : undefined,
              jsonMatched: false,
              checkedAt,
            };
          }

          const jsonValidation = validateJsonPayload(payload, input.jsonRules);

          if (!jsonValidation.matched) {
            return {
              success: false,
              statusCode: response.statusCode,
              responseTimeMs,
              errorMessage: jsonValidation.reason,
              contentMatched: input.requiredText ? true : undefined,
              jsonMatched: false,
              checkedAt,
            };
          }

          return {
            success: true,
            statusCode: response.statusCode,
            responseTimeMs,
            contentMatched: input.requiredText ? true : undefined,
            jsonMatched: true,
            checkedAt,
          };
        }

        return {
          success: true,
          statusCode: response.statusCode,
          responseTimeMs,
          contentMatched: input.requiredText ? true : undefined,
          checkedAt,
        };
      } catch (error) {
        if (attempt < env.CHECK_RETRY_COUNT && isRetryableNetworkError(error)) {
          attempt += 1;
          await sleep(env.CHECK_RETRY_DELAY_MS);
          continue;
        }

        return {
          success: false,
          errorMessage: buildNetworkErrorMessage(error, input.timeoutMs),
          checkedAt: new Date(),
        };
      }
    }
  }
}
