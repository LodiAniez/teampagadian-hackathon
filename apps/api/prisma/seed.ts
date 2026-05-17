import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // TODO: seed believable demo data — see milestone M9 in Linear.
  // Realistic clients (US/EU/AU), invoices spread across the last 6 months,
  // paid + pending + overdue mix, FX comparison data.
  console.log("Seed: nothing to do yet. Implement against the demo path.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
