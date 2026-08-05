import { UpdateUserDto, UserListQueryDto } from "./users.dto";
import {
  UpdateUserInputSchema,
  UserListQuerySchema,
} from "@ai-padrao/contracts";

describe("UsersDto", () => {
  it("UpdateUserDto wraps UpdateUserInputSchema", () => {
    expect(UpdateUserDto).toBeDefined();
    expect(() => UpdateUserInputSchema.parse({})).toThrow();
  });

  it("UserListQueryDto wraps UserListQuerySchema", () => {
    expect(UserListQueryDto).toBeDefined();
    const parsed = UserListQuerySchema.parse({ page: "2", pageSize: "50" });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
  });

  it("UpdateUserInputSchema accepts either name or email", () => {
    const onlyName = UpdateUserInputSchema.parse({ name: "Alice" });
    expect(onlyName.name).toBe("Alice");
    const onlyEmail = UpdateUserInputSchema.parse({ email: "a@b.com" });
    expect(onlyEmail.email).toBe("a@b.com");
  });
});
