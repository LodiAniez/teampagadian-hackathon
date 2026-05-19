import type { BirElection, User as PrismaUser } from "@prisma/client";
import type { BirElection as ContractBirElection, User } from "@raket/contracts";

const BIR_ELECTION_MAP: Record<BirElection, ContractBirElection> = {
  EIGHT_PERCENT: "8_percent",
  GRADUATED: "graduated",
};

export const CONTRACT_TO_PRISMA_ELECTION: Record<ContractBirElection, BirElection> = {
  "8_percent": "EIGHT_PERCENT",
  graduated: "GRADUATED",
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
