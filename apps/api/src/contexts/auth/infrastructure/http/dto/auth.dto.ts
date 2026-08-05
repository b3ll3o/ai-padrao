import { createZodDto } from "nestjs-zod";
import {
  LoginInputSchema,
  RefreshInputSchema,
  RegisterInputSchema,
} from "@ai-padrao/contracts";

export class RegisterDto extends createZodDto(RegisterInputSchema) {}
export class LoginDto extends createZodDto(LoginInputSchema) {}
export class RefreshDto extends createZodDto(RefreshInputSchema) {}
