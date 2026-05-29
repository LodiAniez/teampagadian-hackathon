import type { User as PrismaUser } from "@prisma/client";
import type { User } from "@raket/contracts";

export function toUserDto(user: PrismaUser): User {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    businessName: user.businessName,
    defaultCurrency: user.defaultCurrency,
    defaultHourlyRate: user.defaultHourlyRate as { amount: number; currency: string } | null,
    bir2303Election: user.bir2303Election,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
