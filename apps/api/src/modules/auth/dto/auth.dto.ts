import { createZodDto } from 'nestjs-zod';
import { RegisterInputSchema, LoginInputSchema, RefreshInputSchema } from '@ai-padrao/contracts';

export class RegisterDto extends createZodDto(RegisterInputSchema) {}
export class LoginDto extends createZodDto(LoginInputSchema) {}
export class RefreshDto extends createZodDto(RefreshInputSchema) {}