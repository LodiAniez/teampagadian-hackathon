import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  Client as ClientRow,
  Invoice as InvoiceRow,
  InvoiceLineItem as InvoiceLineItemRow,
  Payment as PaymentRow,
  User as UserRow,
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
    stripeCheckoutUrl: null,
    publicShareToken: null,
    qrCodeDataUrl: null,
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
    service = new InvoicesService(
      prisma,
      parser,
      { createInvoiceCheckoutSession: vi.fn() } as never,
      { toDataUrl: vi.fn() } as never,
      { sendInvoiceEmail: vi.fn() } as never,
      { get: vi.fn(() => "http://localhost:3000") } as never,
    );
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

  describe("parseQuotation", () => {
    const MAGIC: Record<string, Buffer> = {
      "application/pdf": Buffer.from("%PDF-1.4 fake content"),
      "image/png": Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("fake-png-body"),
      ]),
      "image/jpeg": Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("fake-jpeg-body")]),
    };

    function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
      const mimetype = overrides.mimetype ?? "application/pdf";
      return {
        fieldname: "file",
        originalname: "quotation.pdf",
        encoding: "7bit",
        mimetype,
        size: 12345,
        buffer: MAGIC[mimetype] ?? Buffer.from("garbage"),
        stream: undefined as never,
        destination: "",
        filename: "",
        path: "",
        ...overrides,
      };
    }

    const stubDraft = {
      clientName: "Quotation Co",
      clientEmail: null,
      currency: "USD" as const,
      issueDate: "2026-05-22",
      dueDate: "2026-06-21",
      lineItems: [],
      warnings: [],
    };

    it("throws UnprocessableEntityException when no file is provided", async () => {
      await expect(service.parseQuotation(userId, undefined, {})).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(parser.parseFromFile).not.toHaveBeenCalled();
    });

    it("throws UnsupportedMediaTypeException for non-allowed MIME types", async () => {
      await expect(
        service.parseQuotation(userId, mockFile({ mimetype: "text/plain" }), {}),
      ).rejects.toThrow(UnsupportedMediaTypeException);
      expect(parser.parseFromFile).not.toHaveBeenCalled();
    });

    it("accepts application/pdf, image/png, image/jpeg", async () => {
      parser.parseFromFile.mockResolvedValue(stubDraft);

      for (const mimetype of ["application/pdf", "image/png", "image/jpeg"] as const) {
        await expect(service.parseQuotation(userId, mockFile({ mimetype }), {})).resolves.toEqual(
          stubDraft,
        );
      }
      expect(parser.parseFromFile).toHaveBeenCalledTimes(3);
    });

    it("delegates to the parser with file buffer, MIME, and defaultCurrency", async () => {
      parser.parseFromFile.mockResolvedValue(stubDraft);
      const file = mockFile();

      const result = await service.parseQuotation(userId, file, { defaultCurrency: "PHP" });

      expect(parser.parseFromFile).toHaveBeenCalledWith(file.buffer, "application/pdf", "PHP");
      expect(result).toEqual(stubDraft);
    });

    it("passes undefined defaultCurrency through when omitted", async () => {
      parser.parseFromFile.mockResolvedValue(stubDraft);
      const file = mockFile();

      await service.parseQuotation(userId, file, {});

      expect(parser.parseFromFile).toHaveBeenCalledWith(file.buffer, "application/pdf", undefined);
    });

    it("rejects a buffer whose magic bytes don't match the declared MIME (spoofed PDF)", async () => {
      // Client claims application/pdf but the bytes are HTML — common spoof vector.
      const spoof = mockFile({
        mimetype: "application/pdf",
        buffer: Buffer.from("<!DOCTYPE html><html>not a pdf</html>"),
      });
      await expect(service.parseQuotation(userId, spoof, {})).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(parser.parseFromFile).not.toHaveBeenCalled();
    });

    it("rejects a PNG-labelled buffer with PDF magic bytes", async () => {
      const spoof = mockFile({
        mimetype: "image/png",
        buffer: Buffer.from("%PDF-1.4 still a pdf"),
      });
      await expect(service.parseQuotation(userId, spoof, {})).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(parser.parseFromFile).not.toHaveBeenCalled();
    });

    it("throws 429 after exceeding the per-user rate limit (10/min) and lets a different user through", async () => {
      parser.parseFromFile.mockResolvedValue(stubDraft);

      for (let i = 0; i < 10; i++) {
        await expect(service.parseQuotation(userId, mockFile(), {})).resolves.toEqual(stubDraft);
      }

      const overflow = service.parseQuotation(userId, mockFile(), {});
      await expect(overflow).rejects.toBeInstanceOf(HttpException);
      await expect(overflow).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

      const otherUserId = "00000000-0000-0000-0000-0000000000ff";
      await expect(service.parseQuotation(otherUserId, mockFile(), {})).resolves.toEqual(stubDraft);
    });

    it("resets the rate-limit window after PARSE_QUOTATION_WINDOW_MS elapses", async () => {
      parser.parseFromFile.mockResolvedValue(stubDraft);
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"));
      try {
        for (let i = 0; i < 10; i++) {
          await service.parseQuotation(userId, mockFile(), {});
        }
        await expect(service.parseQuotation(userId, mockFile(), {})).rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
        });
        vi.setSystemTime(new Date("2026-05-28T12:01:00.500Z"));
        await expect(service.parseQuotation(userId, mockFile(), {})).resolves.toEqual(stubDraft);
      } finally {
        vi.useRealTimers();
      }
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

  describe("listItems", () => {
    const mockPaymentRow = (overrides: Partial<Pick<PaymentRow, "amountPhp">> = {}) => ({
      amountPhp: new Prisma.Decimal("12345.67"),
      ...overrides,
    });

    const mockListItemRow = (
      overrides: Partial<InvoiceRow> = {},
      payments: Array<Pick<PaymentRow, "amountPhp">> = [],
    ) =>
      ({
        ...mockInvoiceRow(overrides),
        client: { id: clientId, name: "Acme Co." },
        payments,
      }) as never;

    it("returns rows with amountPhp: null when no SETTLED payment exists", async () => {
      prisma.invoice.findMany.mockResolvedValue([
        mockListItemRow({ id: "inv-a" }),
        mockListItemRow({ id: "inv-b" }),
      ]);

      const result = await service.listItems(userId, { limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].amountPhp).toBeNull();
      expect(result.data[1].amountPhp).toBeNull();
    });

    it("populates amountPhp from the latest SETTLED payment when present", async () => {
      const mockRow: InvoiceRow = mockInvoiceRow({ id: "inv-1", status: "paid" });
      prisma.invoice.findMany.mockResolvedValue([mockListItemRow(mockRow, [mockPaymentRow()])]);

      const result = await service.listItems(userId, { limit: 20 });

      expect(result.data[0].amountPhp).toBe(12345.67);
      // Regression guard: locks the `amount` (not `total`) field round-trip
      // against the ticket's pseudocode error. The mapper reads row.amount;
      // a refactor to row.total would surface as NaN here.
      expect(result.data[0].amount).toBe(Number(mockRow.amount));
    });

    it("filters the payments include to morphTxStatus: SETTLED (excludes SETTLING/FAILED)", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.include).toMatchObject({
        payments: { where: { morphTxStatus: "SETTLED" } },
      });
    });

    it("orders the payments include by paidAt desc, take: 1 (latest SETTLED wins)", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.include).toMatchObject({
        payments: { orderBy: { paidAt: "desc" }, take: 1 },
      });
    });

    it("returns nextCursor as the id of the popped tail row when more pages exist", async () => {
      // findMany returns limit+1 rows; the (limit+1)-th is the tail whose id becomes nextCursor.
      const rows = Array.from({ length: 21 }, (_, i) =>
        mockListItemRow({ id: `inv-${String(i).padStart(2, "0")}` }),
      );
      prisma.invoice.findMany.mockResolvedValue(rows);

      const result = await service.listItems(userId, { limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe("inv-20");
    });

    it("returns nextCursor: null on the last page (rows < limit + 1)", async () => {
      prisma.invoice.findMany.mockResolvedValue([
        mockListItemRow({ id: "inv-1" }),
        mockListItemRow({ id: "inv-2" }),
      ]);

      const result = await service.listItems(userId, { limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it("returns empty data and null nextCursor when no invoices match", async () => {
      // Distinct from the "<limit+1 rows" case — explicitly exercises the
      // zero-rows branch. Sanity-asserts the service didn't short-circuit
      // before querying (findMany should still be called).
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.listItems(userId, { limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
    });

    it("forwards cursor + skip: 1 only when query.cursor is set", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20 });
      const noCursorCall = prisma.invoice.findMany.mock.calls[0][0];
      expect(noCursorCall?.cursor).toBeUndefined();
      expect(noCursorCall?.skip).toBeUndefined();

      await service.listItems(userId, { limit: 20, cursor: "inv-cursor" });
      const cursorCall = prisma.invoice.findMany.mock.calls[1][0];
      expect(cursorCall?.cursor).toEqual({ id: "inv-cursor" });
      expect(cursorCall?.skip).toBe(1);
    });

    it("forwards the status filter verbatim (lowercase 'paid', no uppercase normalization)", async () => {
      // Regression guard: the ticket pseudocode suggested uppercase ("PAID");
      // the Prisma enum is lowercase. This locks the where clause to the
      // contract value.
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20, status: "paid" });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.where).toMatchObject({ status: "paid" });
    });

    it("does not pass a status filter when query.status is omitted", async () => {
      // Symmetric guard for the conditional spread `...(query.status ? { status } : {})`.
      // Passing `status: undefined` would silently match nothing in Prisma; the key
      // must be absent entirely. Locks the omission shape against a future refactor.
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.where).toEqual(expect.not.objectContaining({ status: expect.anything() }));
    });

    it("forwards the clientId filter to the where clause", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      const filterClientId = "00000000-0000-0000-0000-0000000000c1";

      await service.listItems(userId, { limit: 20, clientId: filterClientId });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.where).toMatchObject({ clientId: filterClientId });
    });

    it("always scopes the where clause to the authenticated userId", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20, status: "paid", clientId });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.where).toMatchObject({ userId });
    });

    it("orders by createdAt desc (reverse chronological)", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.listItems(userId, { limit: 20 });

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call?.orderBy).toEqual({ createdAt: "desc" });
    });

    it("drops sensitive/internal fields from the list-item projection", async () => {
      prisma.invoice.findMany.mockResolvedValue([
        mockListItemRow({ id: "inv-1", stripePaymentIntentId: "pi_test_123" }),
      ]);

      const result = await service.listItems(userId, { limit: 20 });
      const item = result.data[0];

      for (const leaked of [
        "clientId",
        "lineItems",
        "stripePaymentIntentId",
        "sourceType",
        "userId",
      ]) {
        expect(item).not.toHaveProperty(leaked);
      }
    });
  });

  describe("getByPublicToken", () => {
    const SHARE_TOKEN = "shareTokenAbc123";
    const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_xyz";
    const QR_URL = "data:image/png;base64,abcd";

    const mockUser: UserRow = {
      id: userId,
      supabaseUserId: null,
      phone: "+639171234567",
      name: "Juan dela Cruz",
      businessName: "Juan's Studio",
      defaultCurrency: "USD",
      defaultHourlyRate: null,
      bir2303Election: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const mockPublicRow = (overrides: Partial<InvoiceRow> = {}) =>
      ({
        ...mockInvoiceRow({
          status: "sent",
          publicShareToken: SHARE_TOKEN,
          stripeCheckoutUrl: STRIPE_URL,
          qrCodeDataUrl: QR_URL,
          ...overrides,
        }),
        client: mockClient,
        lineItems: [mockLineItemRow()],
        user: mockUser,
      }) as never;

    it("returns a sanitized DTO for a sent invoice with checkout URL exposed", async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow());

      const dto = await service.getByPublicToken(SHARE_TOKEN);

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicShareToken: SHARE_TOKEN },
          include: expect.objectContaining({ user: true, client: true }),
        }),
      );
      expect(dto.status).toBe("sent");
      expect(dto.stripeCheckoutUrl).toBe(STRIPE_URL);
      expect(dto.qrCodeDataUrl).toBe(QR_URL);
      expect(dto.token).toBe(SHARE_TOKEN);
      expect(dto.freelancer).toEqual({ name: "Juan dela Cruz", businessName: "Juan's Studio" });
      expect(dto.client).toEqual({ name: "Acme Co." });
    });

    it("nulls out stripeCheckoutUrl and qrCodeDataUrl for a paid invoice", async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow({ status: "paid" }));

      const dto = await service.getByPublicToken(SHARE_TOKEN);

      expect(dto.status).toBe("paid");
      expect(dto.stripeCheckoutUrl).toBeNull();
      expect(dto.qrCodeDataUrl).toBeNull();
    });

    it("throws NotFoundException when the token does not match any invoice", async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.getByPublicToken("does-not-exist")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the invoice is still a draft (no existence leak)", async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow({ status: "draft" }));

      await expect(service.getByPublicToken(SHARE_TOKEN)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the invoice has been voided", async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow({ status: "void" }));

      await expect(service.getByPublicToken(SHARE_TOKEN)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the invoice is overdue", async () => {
      // regression guard: a future "positive include" guard (e.g. status !== "draft")
      // would silently expose overdue invoices through the public link.
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow({ status: "overdue" }));

      await expect(service.getByPublicToken(SHARE_TOKEN)).rejects.toThrow(NotFoundException);
    });

    it("does not expose internal/PII fields in the returned DTO", async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockPublicRow());

      const dto = await service.getByPublicToken(SHARE_TOKEN);
      const keys = Object.keys(dto);

      for (const leaked of [
        "userId",
        "clientId",
        "stripeCheckoutSessionId",
        "stripePaymentIntentId",
        "sentAt",
        "id",
        "createdAt",
      ]) {
        expect(keys).not.toContain(leaked);
      }
      // The trimmed client/freelancer projections also must not leak contact details.
      expect(Object.keys(dto.client)).toEqual(["name"]);
      expect(Object.keys(dto.freelancer).sort()).toEqual(["businessName", "name"]);
      // Explicit leak-prevention regression: `phone` is on the User row but
      // must never reach the public DTO.
      expect(dto.freelancer).not.toHaveProperty("phone");
    });
  });
});
