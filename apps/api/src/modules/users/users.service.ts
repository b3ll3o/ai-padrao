import { Injectable, NotFoundException } from '@nestjs/common';
// Nest DI needs the runtime value here; `import type` erases it from design:paramtypes.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { UpdateUserInput, UserListQuery, UserDto } from '@ai-padrao/contracts';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQuery): Promise<{ items: UserDto[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, q } = query;
    const where = q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items as UserDto[], total, page, pageSize };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user as UserDto;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: input,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    return user as UserDto;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
