import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  Client as ClientRow,
  Invoice as InvoiceRow,
  InvoiceLineItem as InvoiceLineItemRow,
} from "@prisma/client";
import { InvoicesService } from "../invoices.service";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { InvoiceParserService } from "../invoice-parser.service";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let prisma: DeepMockProxy<PrismaService>;
  let parser: DeepMockProxy<InvoiceParserService>;

  const userId = "00000000-0000-0000-0000-000000000001";
  const clientId = "00000000-0000-0000-0000-0000000000a1";
  const currentYear = new Date().getFullYear();

  const mockClient: ClientRow = {
    id: clientId,
    userId,
    name: "Acme Co.",
    email: "billing@acme.example",
    country: "US",
    defaultCurrency: "USD",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  const mockLineItemRow = (overrides: Partial<InvoiceLineItemRow> = {}): InvoiceLineItemRow => ({
    id: "li-1",
    invoiceId: "inv-1",
    description: "Design",
    quantity: new Prisma.Decimal(10),
    unit: "hours",
    rate: new Prisma.Decimal(150),
    amount: new Prisma.Decimal(1500),
    position: 0,
    ...overrides,
  });

  const mockInvoiceRow = (overrides: Partial<InvoiceRow> = {}): InvoiceRow => ({
    id: "inv-1",
    userId,
    clientId,
    number: `INV-${currentYear}-0001`,
    status: "draft",
    amount: new Prisma.Decimal(1500),
    currency: "USD",
    issueDate: new Date("2026-01-15"),
    dueDate: new Date("2026-02-14"),
    sourceType: "text",
    sourceFileUrl: null,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockInvoiceWithRelations = (overrides: Partial<InvoiceRow> = {}) =>
    ({
      ...mockInvoiceRow(overrides),
      client: mockClient,
      lineItems: [mockLineItemRow()],
    }) as never;

  const baseBody = {
    currency: "USD" as const,
    issueDate: `${currentYear}-01-15`,
    dueDate: `${currentYear}-02-14`,
    sourceType: "text" as const,
    lineItems: [{ description: "Design", quantity: 10, unit: "hours", rate: 150 }],
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    parser = mockDeep<InvoiceParserService>();
    prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => unknown) =>
      Promise.resolve(cb(prisma)),
    );
    service = new InvoicesService(prisma, parser);
  });

  describe("create — clientId path", () => {
    it("links the existing client when clientId belongs to the user", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      const result = await service.create(userId, { ...baseBody, clientId });

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(result.clientId).toBe(clientId);
      expect(result.client.id).toBe(clientId);
      expect(result.number).toBe(`INV-${currentYear}-0001`);
    });

    it("throws NotFoundException when clientId doesn't belong to the user", async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, { ...baseBody, clientId })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create — clientName path", () => {
    it("links existing client when clientName matches case-insensitively", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      const result = await service.create(userId, { ...baseBody, clientName: "acme co." });

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { userId, name: { equals: "acme co.", mode: "insensitive" } },
      });
      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(result.client.id).toBe(clientId);
    });

    it("creates a new client when clientName has no match", async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      const newClient: ClientRow = {
        ...mockClient,
        id: "new-client-id",
        name: "New Co.",
        email: "ops@new.example",
        country: "PH",
      };
      prisma.client.create.mockResolvedValue(newClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(
        mockInvoiceWithRelations({ clientId: "new-client-id" }),
      );

      await service.create(userId, {
        ...baseBody,
        clientName: "New Co.",
        clientEmail: "ops@new.example",
        clientCountry: "PH",
      });

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: "New Co.",
          email: "ops@new.example",
          country: "PH",
          defaultCurrency: "USD",
        },
      });
    });

    it("creates a client with null email/country when those fields are omitted", async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue({
        ...mockClient,
        id: "minimal-id",
        email: null,
        country: null,
      });
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      await service.create(userId, { ...baseBody, clientName: "Minimal Co." });

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: "Minimal Co.",
          email: null,
          country: null,
          defaultCurrency: "USD",
        },
      });
    });
  });

  describe("create — invoice number generation", () => {
    it("formats as INV-YYYY-NNNN (4-digit zero-padded) using MAX(suffix)+1", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(
        mockInvoiceRow({ number: `INV-${currentYear}-0007` }),
      );
      prisma.invoice.create.mockResolvedValue(
        mockInvoiceWithRelations({ number: `INV-${currentYear}-0008` }),
      );

      await service.create(userId, { ...baseBody, clientId });

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { userId, number: { startsWith: `INV-${currentYear}-` } },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const call = prisma.invoice.create.mock.calls[0][0];
      expect(call.data.number).toBe(`INV-${currentYear}-0008`);
    });

    it("starts at 0001 for the year's first invoice", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      await service.create(userId, { ...baseBody, clientId });

      const call = prisma.invoice.create.mock.calls[0][0];
      expect(call.data.number).toBe(`INV-${currentYear}-0001`);
    });

    it("does not reissue a deleted number — picks MAX(suffix)+1 even if earlier numbers are gone", async () => {
      // Latest remaining is 0009 (0008 was deleted). Next should be 0010, never 0009.
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(
        mockInvoiceRow({ number: `INV-${currentYear}-0009` }),
      );
      prisma.invoice.create.mockResolvedValue(
        mockInvoiceWithRelations({ number: `INV-${currentYear}-0010` }),
      );

      await service.create(userId, { ...baseBody, clientId });

      const call = prisma.invoice.create.mock.calls[0][0];
      expect(call.data.number).toBe(`INV-${currentYear}-0010`);
    });
  });

  describe("create — concurrent-number conflict retry", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["userId", "number"] },
    });

    it("retries once on P2002(userId,number) and succeeds with the recomputed number", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      // Attempt 1: latest is 0007 → tries 0008, loses race to a concurrent writer.
      // Attempt 2: latest is now 0008 → tries 0009, wins.
      prisma.invoice.findFirst
        .mockResolvedValueOnce(mockInvoiceRow({ number: `INV-${currentYear}-0007` }))
        .mockResolvedValueOnce(mockInvoiceRow({ number: `INV-${currentYear}-0008` }));
      prisma.invoice.create
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce(mockInvoiceWithRelations({ number: `INV-${currentYear}-0009` }));

      const result = await service.create(userId, { ...baseBody, clientId });

      expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
      expect(prisma.invoice.create.mock.calls[0][0].data.number).toBe(`INV-${currentYear}-0008`);
      expect(prisma.invoice.create.mock.calls[1][0].data.number).toBe(`INV-${currentYear}-0009`);
      expect(result.number).toBe(`INV-${currentYear}-0009`);
    });

    it("does NOT retry on non-P2002 errors — they bubble immediately", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      const otherErr = new Error("connection reset");
      prisma.invoice.create.mockRejectedValueOnce(otherErr);

      await expect(service.create(userId, { ...baseBody, clientId })).rejects.toBe(otherErr);
      expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on P2002 for unrelated unique columns", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      const unrelated = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["stripePaymentIntentId"] },
      });
      prisma.invoice.create.mockRejectedValueOnce(unrelated);

      await expect(service.create(userId, { ...baseBody, clientId })).rejects.toBe(unrelated);
      expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    });

    it("bubbles P2002 after the one retry also fails (no infinite loop)", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockRejectedValue(p2002);

      await expect(service.create(userId, { ...baseBody, clientId })).rejects.toBe(p2002);
      expect(prisma.invoice.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("create — totals & line items", () => {
    it("computes amount server-side from line items, ignoring any client-sent total", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      await service.create(userId, {
        ...baseBody,
        clientId,
        lineItems: [
          { description: "A", quantity: 10, unit: "hours", rate: 200 },
          { description: "B", quantity: 5, unit: "hours", rate: 300 },
        ],
      });

      const call = prisma.invoice.create.mock.calls[0][0];
      // 10*200 + 5*300 = 3500
      expect(new Prisma.Decimal(call.data.amount as Prisma.Decimal).toNumber()).toBe(3500);
    });

    it("returns embedded client and line items in DTO", async () => {
      prisma.client.findFirst.mockResolvedValue(mockClient);
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(mockInvoiceWithRelations());

      const result = await service.create(userId, { ...baseBody, clientId });

      expect(result.client).toBeDefined();
      expect(result.client.name).toBe("Acme Co.");
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toBe("Design");
    });
  });

  describe("getById", () => {
    it("returns invoice with embedded client", async () => {
      prisma.invoice.findFirst.mockResolvedValue(mockInvoiceWithRelations());

      const result = await service.getById(userId, "inv-1");

      const call = prisma.invoice.findFirst.mock.calls[0][0];
      expect(call?.include).toMatchObject({ client: true });
      expect(result.client.id).toBe(clientId);
    });

    it("throws NotFoundException when invoice doesn't exist for the user", async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.getById(userId, "missing-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("includes embedded client in each row", async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoiceWithRelations()]);

      const result = await service.list(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.include).toMatchObject({ client: true });
      expect(result.data[0].client.id).toBe(clientId);
    });

    it("scopes queries to the authenticated user", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.list(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.where).toMatchObject({ userId });
    });

    it("orders embedded lineItems by position asc (matches getById/create)", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.list(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.include).toMatchObject({
        client: true,
        lineItems: { orderBy: { position: "asc" } },
      });
    });
  });
});
