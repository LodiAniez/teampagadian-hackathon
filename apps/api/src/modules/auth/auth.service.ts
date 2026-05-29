import { Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateProfileDto, User } from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { toUserDto } from "./auth.mapper";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return toUserDto(user);
  }

  async updateProfile(userId: string, body: UpdateProfileDto): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.businessName !== undefined && { businessName: body.businessName }),
        ...(body.defaultCurrency !== undefined && { defaultCurrency: body.defaultCurrency }),
        ...(body.defaultHourlyRate !== undefined && {
          defaultHourlyRate: body.defaultHourlyRate,
        }),
        ...(body.bir2303Election !== undefined && {
          bir2303Election: body.bir2303Election,
        }),
      },
    });
    return toUserDto(user);
  }
}
