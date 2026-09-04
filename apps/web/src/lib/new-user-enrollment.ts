export function buildNewUserEnrollment(input: { name: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  return {
    account: {
      name: input.name.trim(),
      email,
    },
    verification: {
      email,
      callbackURL: "/sifremi-unuttum",
    },
  };
}

export function adminUserCreationContainsPassword(body: unknown): boolean {
  return typeof body === "object" && body !== null && Object.prototype.hasOwnProperty.call(body, "password");
}
