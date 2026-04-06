export interface ContentValidationResult {
  matched: boolean;
  reason?: string;
}

export function validateRequiredText(body: string, requiredText?: string | null): ContentValidationResult {
  if (!requiredText) {
    return {
      matched: true,
    };
  }

  const matched = body.includes(requiredText);

  return matched
    ? {
        matched: true,
      }
    : {
        matched: false,
        reason: `Не найден обязательный текст: "${requiredText}"`,
      };
}
