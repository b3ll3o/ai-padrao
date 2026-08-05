import { z } from "zod";
import { UserRoleSchema } from "./auth";

export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  version: z.number().int().min(0),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const UserHistoryEntrySchema = z.object({
  id: z.string(),
  originalId: z.string(),
  version: z.number().int().min(0),
  operation: z.enum(["CREATE", "UPDATE", "DELETE", "RESTORE"]),
  changedAt: z.coerce.date(),
  changedBy: z.string().nullable(),
  snapshot: z.unknown(),
});
export type UserHistoryEntry = z.infer<typeof UserHistoryEntrySchema>;

export const UpdateUserInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "At least one field must be provided",
  });
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;
