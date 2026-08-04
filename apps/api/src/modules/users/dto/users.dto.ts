import { createZodDto } from 'nestjs-zod';
import { UpdateUserInputSchema, UserListQuerySchema } from '@ai-padrao/contracts';

export class UpdateUserDto extends createZodDto(UpdateUserInputSchema) {}
export class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
