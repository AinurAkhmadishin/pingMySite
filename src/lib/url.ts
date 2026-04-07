import { isIP } from "node:net";

export function sanitizeText(value: string, maxLength = 255): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function isValidHostnameLabel(label: string): boolean {
  return /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-");
}

function assertValidWebsiteHostname(hostname: string): void {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (normalizedHostname === "localhost" || isIP(normalizedHostname)) {
    return;
  }

  const labels = normalizedHostname.split(".");

  if (labels.length < 2 || labels.at(-1)?.length === 1) {
    throw new Error("Укажите корректный адрес сайта, например example.com.");
  }

  if (labels.some((label) => label.length === 0 || label.length > 63 || !isValidHostnameLabel(label))) {
    throw new Error("Укажите корректный адрес сайта, например example.com.");
  }
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Поддерживаются только HTTP и HTTPS URL.");
  }

  assertValidWebsiteHostname(url.hostname);

  url.hash = "";

  if (url.pathname === "") {
    url.pathname = "/";
  }

  return url.toString();
}

export function isHttpsUrl(url: string): boolean {
  return new URL(url).protocol === "https:";
}
