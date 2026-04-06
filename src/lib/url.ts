export function sanitizeText(value: string, maxLength = 255): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Поддерживаются только HTTP и HTTPS URL.");
  }

  url.hash = "";

  if (url.pathname === "") {
    url.pathname = "/";
  }

  return url.toString();
}

export function isHttpsUrl(url: string): boolean {
  return new URL(url).protocol === "https:";
}
