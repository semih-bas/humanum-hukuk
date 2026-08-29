type AttemptWindow = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptWindow>();

export function consumeSensitiveActionAttempt(key: string, options: { max: number; windowMs: number }): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearSensitiveActionAttempts(key: string): void {
  attempts.delete(key);
}
