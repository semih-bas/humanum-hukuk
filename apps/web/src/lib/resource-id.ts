import { z } from "zod";

export const resourceIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9:_-]+$/i);
