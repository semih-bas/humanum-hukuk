export function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function requireHttpUrl(name: string): string {
  const value = requireEnvironmentVariable(name);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${name}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol in environment variable: ${name}`);
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !isLoopbackHostname(url.hostname)) {
    throw new Error(`${name} must use HTTPS in production.`);
  }

  return url.origin;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
