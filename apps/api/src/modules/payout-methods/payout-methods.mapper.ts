import { InternalServerErrorException } from "@nestjs/common";
import { PayoutMethodType } from "@prisma/client";
import type { PayoutMethod as PayoutMethodRow } from "@prisma/client";
import type { PayoutMethod, PayoutMethodType as ContractType } from "@raket/contracts";
import {
  CardDetailsSchema,
  GcashDetailsSchema,
  MayaDetailsSchema,
  BankAccountDetailsSchema,
} from "@raket/contracts";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

export const PRISMA_TO_CONTRACT_TYPE = {
  CARD: "card",
  GCASH: "gcash",
  MAYA: "maya",
  BANK_ACCOUNT: "bank_account",
} as const satisfies Record<PayoutMethodType, ContractType>;

export const CONTRACT_TO_PRISMA_TYPE = {
  card: PayoutMethodType.CARD,
  gcash: PayoutMethodType.GCASH,
  maya: PayoutMethodType.MAYA,
  bank_account: PayoutMethodType.BANK_ACCOUNT,
} as const satisfies Record<ContractType, PayoutMethodType>;

function parseDetails<T>(schema: ZodSchema<T>, row: PayoutMethodRow): T {
  try {
    return schema.parse(row.details);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new InternalServerErrorException(
        `Payout method ${row.id} has malformed ${row.type} details in storage`,
      );
    }
    throw err;
  }
}

export function toPayoutMethodDto(row: PayoutMethodRow): PayoutMethod {
  const type = PRISMA_TO_CONTRACT_TYPE[row.type];
  const base = {
    id: row.id,
    userId: row.userId,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  switch (type) {
    case "card":
      return { ...base, type, details: parseDetails(CardDetailsSchema, row) };
    case "gcash":
      return { ...base, type, details: parseDetails(GcashDetailsSchema, row) };
    case "maya":
      return { ...base, type, details: parseDetails(MayaDetailsSchema, row) };
    case "bank_account":
      return { ...base, type, details: parseDetails(BankAccountDetailsSchema, row) };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown payout method type: ${_exhaustive}`);
    }
  }
}
