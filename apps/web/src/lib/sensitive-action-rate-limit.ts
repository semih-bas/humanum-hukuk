import { clearDurableRateLimit, consumeDurableRateLimit } from "./email-rate-limit";

type Decision = { allowed: boolean; retryAfterSeconds: number };
type Consume = (key: string, options: { max: number; windowMs: number }) => Promise<Decision>;
type Clear = (key: string) => Promise<void>;

export function consumeSensitiveActionAttempt(key: string, options: { max: number; windowMs: number }, consume: Consume = consumeDurableRateLimit) {
  return consume(`sensitive-action:${key}`, options);
}

export function clearSensitiveActionAttempts(key: string, clear: Clear = clearDurableRateLimit): Promise<void> {
  return clear(`sensitive-action:${key}`);
}
