import type { BirElection, User as PrismaUser } from "@prisma/client";
import type { User } from "@raket/contracts";

const BIR_ELECTION_MAP: Record<BirElection, "8_percent" | "graduated"> = {
  EIGHT_PERCENT: "8_percent",
  GRADUATED: "graduated",
};

export function toUserDto(user: PrismaUser): User {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    businessName: user.businessName,
    defaultCurrency: user.defaultCurrency,
    defaultHourlyRate: user.defaultHourlyRate as { amount: number; currency: string } | null,
    bir2303Election: user.bir2303Election ? BIR_ELECTION_MAP[user.bir2303Election] : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
