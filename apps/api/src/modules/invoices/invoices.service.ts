import { randomBytes } from "node:crypto";
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { Client as ClientRow } from "@prisma/client";
import {
  type CreateInvoiceBody,
  type Invoice,
  type InvoiceListItem,
  type InvoiceStatus,
  type PaginatedResponse,
  type ParseInvoiceTextBody,
  type ParseQuotationBody,
  type ParsedInvoiceDraft,
  type PublicInvoiceResponse,
  type QuotationMimeType,
  QUOTATION_MIME_TYPES,
  type SendInvoiceBody,
  type SendInvoiceResponse,
} from "@raket/contracts";
import type { EnvConfig } from "@/common/config/env.schema";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EmailService } from "../integrations/email/email.service";
import { QrService } from "../integrations/qr/qr.service";
import { StripeService } from "../integrations/stripe/stripe.service";
import { InvoiceParserService } from "./invoice-parser.service";
import {
  toInvoiceDto,
  toInvoiceListItem,
  toPublicInvoiceDto,
  type InvoiceRowWithClientAndLineItems,
} from "./invoices.mapper";

type ListQuery = {
  cursor?: string;
  limit: number;
  status?: InvoiceStatus;
  clientId?: string;
};

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceParser: InvoiceParserService,
    private readonly stripeService: StripeService,
    private readonly qrService: QrService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async list(userId: string, query: ListQuery): Promise<PaginatedResponse<Invoice>> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.clientId ? { clientId: query.clientId } : {}),
      },
      // Embedding the full client per row inflates payload when one client owns many
      // invoices; revisit (clientId + included.clients[]) if list pages get large.
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | null = null;
    if (rows.length > query.limit) {
      const last = rows.pop();
      nextCursor = last ? last.id : null;
    }

    return {
      data: rows.map(toInvoiceDto),
      nextCursor,
    };
  }

  async listItems(userId: string, query: ListQuery): Promise<PaginatedResponse<InvoiceListItem>> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.clientId ? { clientId: query.clientId } : {}),
      },
      // SETTLED-only filter is load-bearing: SETTLING/FAILED payments must NOT
      // populate amountPhp in the list view, or a user sees a green "paid in PHP"
      // figure for an on-chain transfer that's still inflight or has failed.
      include: {
        client: { select: { id: true, name: true } },
        payments: {
          where: { morphTxStatus: "SETTLED" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { amountPhp: true },
        },
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | null = null;
    if (rows.length > query.limit) {
      const last = rows.pop();
      nextCursor = last ? last.id : null;
    }

    return {
      data: rows.map(toInvoiceListItem),
      nextCursor,
    };
  }

  async getById(userId: string, invoiceId: string): Promise<Invoice> {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
    });
    if (!row) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }
    return toInvoiceDto(row);
  }

  async create(userId: string, body: CreateInvoiceBody): Promise<Invoice> {
    // Two concurrent creates can pick the same INV-YYYY-NNNN before either commits;
    // the second hits @@unique([userId, number]) → P2002. One retry recomputes
    // MAX(suffix)+1 (now including the winner) and gets the next number. For
    // stronger guarantees under heavy contention, move to a sequence table with
    // SELECT ... FOR UPDATE — see "should-fix" #3 in the TEA-31 review.
    try {
      return await this.tryCreate(userId, body);
    } catch (err) {
      if (isInvoiceNumberConflict(err)) {
        return this.tryCreate(userId, body);
      }
      throw err;
    }
  }

  private tryCreate(userId: string, body: CreateInvoiceBody): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const client = await this.resolveClient(tx, userId, body);
      const number = await this.nextInvoiceNumber(tx, userId, body.issueDate);
      const total = body.lineItems.reduce(
        (sum, li) => sum.add(new Prisma.Decimal(li.quantity).mul(new Prisma.Decimal(li.rate))),
        new Prisma.Decimal(0),
      );

      const created = await tx.invoice.create({
        data: {
          userId,
          clientId: client.id,
          number,
          status: "draft",
          amount: total,
          currency: body.currency,
          issueDate: new Date(body.issueDate),
          dueDate: new Date(body.dueDate),
          sourceType: body.sourceType,
          lineItems: {
            create: body.lineItems.map((li, position) => ({
              description: li.description,
              quantity: new Prisma.Decimal(li.quantity),
              unit: li.unit,
              rate: new Prisma.Decimal(li.rate),
              amount: new Prisma.Decimal(li.quantity).mul(new Prisma.Decimal(li.rate)),
              position,
            })),
          },
        },
        include: {
          client: true,
          lineItems: { orderBy: { position: "asc" } },
        },
      });

      return toInvoiceDto(created);
    });
  }

  private async resolveClient(
    tx: Prisma.TransactionClient,
    userId: string,
    body: CreateInvoiceBody,
  ): Promise<ClientRow> {
    // clientEmail / clientCountry on the body are snapshotted onto a *newly created*
    // client only — they are intentionally NOT used to update an existing client
    // matched by id or by name. Editing a client is a separate concern.
    if (body.clientId) {
      const found = await tx.client.findFirst({
        where: { id: body.clientId, userId },
      });
      if (!found) {
        throw new NotFoundException(`Client ${body.clientId} not found`);
      }
      return found;
    }

    const clientName = body.clientName;
    if (!clientName) {
      // Unreachable: the contract's XOR refine guarantees one of clientId/clientName
      // is set. If we get here something is wired wrong, not a user input error.
      throw new Error("Invariant: clientId or clientName must be present after refine");
    }

    const existing = await tx.client.findFirst({
      where: { userId, name: { equals: clientName, mode: "insensitive" } },
    });
    if (existing) {
      return existing;
    }

    return tx.client.create({
      data: {
        userId,
        name: clientName,
        email: body.clientEmail ?? null,
        country: body.clientCountry ?? null,
        // Snapshot of the first invoice's currency. Subsequent invoices in other
        // currencies won't update this; treat it as the client's preferred default.
        defaultCurrency: body.currency,
      },
    });
  }

  private async nextInvoiceNumber(
    tx: Prisma.TransactionClient,
    userId: string,
    issueDate: string,
  ): Promise<string> {
    const year = new Date(issueDate).getFullYear();
    // MAX(suffix)+1 rather than COUNT+1 so a deleted invoice's number is never reissued.
    // `INV-YYYY-NNNN` is lexically sortable within a year, so ordering by `number desc` is safe.
    const last = await tx.invoice.findFirst({
      where: { userId, number: { startsWith: `INV-${year}-` } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const lastN = last ? Number(last.number.slice(-4)) : 0;
    return `INV-${year}-${String(lastN + 1).padStart(4, "0")}`;
  }

  async parseText(_userId: string, body: ParseInvoiceTextBody): Promise<ParsedInvoiceDraft> {
    return this.invoiceParser.parse(body.text, body.defaultCurrency);
  }

  // Fixed-window per-user rate limit for parse-quotation. In-memory and per-instance
  // by design (single API replica during hackathon); swap for Redis if we scale out.
  // Keyed by userId so an attacker can't drain the shared Gemini quota by hammering
  // one endpoint. Window resets on the next call after expiry — good enough for
  // free-tier protection, not a fairness guarantee.
  private static readonly PARSE_QUOTATION_LIMIT = 10;
  private static readonly PARSE_QUOTATION_WINDOW_MS = 60_000;
  private readonly parseQuotationCounters = new Map<
    string,
    { count: number; windowStart: number }
  >();

  async parseQuotation(
    userId: string,
    file: Express.Multer.File | undefined,
    body: ParseQuotationBody,
  ): Promise<ParsedInvoiceDraft> {
    if (!file) {
      throw new UnprocessableEntityException("file is required");
    }
    if (!isQuotationMimeType(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${QUOTATION_MIME_TYPES.join(", ")}`,
      );
    }
    // Header-claimed MIME is client-controlled; verify the file's actual magic
    // bytes so a shell script labeled application/pdf doesn't reach Gemini.
    if (!matchesQuotationMagic(file.buffer, file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `File contents do not match the declared type ${file.mimetype}`,
      );
    }
    this.assertParseQuotationWithinRateLimit(userId);
    return this.invoiceParser.parseFromFile(file.buffer, file.mimetype, body.defaultCurrency);
  }

  private assertParseQuotationWithinRateLimit(userId: string): void {
    const now = Date.now();
    const entry = this.parseQuotationCounters.get(userId);
    if (!entry || now - entry.windowStart >= InvoicesService.PARSE_QUOTATION_WINDOW_MS) {
      this.parseQuotationCounters.set(userId, { count: 1, windowStart: now });
      return;
    }
    if (entry.count >= InvoicesService.PARSE_QUOTATION_LIMIT) {
      throw new HttpException(
        `Rate limit exceeded: max ${InvoicesService.PARSE_QUOTATION_LIMIT} parse-quotation requests per minute`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
  }

  async send(
    userId: string,
    invoiceId: string,
    body: SendInvoiceBody,
  ): Promise<SendInvoiceResponse> {
    const row = await this.findRawInvoice(userId, invoiceId);

    if (row.status === "sent") {
      // publicShareToken guard prevents returning a malformed preview URL
      // (`/invoice/null`) for legacy pre-TEA-37 rows; surfacing 500 is
      // preferable to handing the freelancer a broken share link.
      if (!row.stripeCheckoutUrl || !row.qrCodeDataUrl || !row.publicShareToken) {
        throw new InternalServerErrorException(
          "Sent invoice is missing Stripe/QR data or share token",
        );
      }
      return {
        invoice: toInvoiceDto(row),
        checkoutUrl: this.buildPreviewUrl(row.publicShareToken),
        qrCodeDataUrl: row.qrCodeDataUrl,
      };
    }

    if (row.status !== "draft") {
      throw new ConflictException(`Invoice cannot be sent: status is ${row.status}`);
    }

    // Optimistic lock against concurrent send() calls (network retry, double-tap,
    // StrictMode double-invoke). The first writer flips sentAt from null → now and
    // wins the right to create the Stripe session; the loser sees count=0.
    //
    // Stale-lock recovery: if a previous send crashed between the lock acquire
    // and the final status-flip, sentAt is set but status is still "draft" — the
    // row would be permanently un-resendable otherwise. Treat a sentAt older
    // than STALE_LOCK_MS on a draft row as abandoned and reclaim it. The
    // try/catch below also releases the lock on failure so this path is rare.
    const STALE_LOCK_MS = 60_000;
    const sendStartedAt = new Date();
    const staleThreshold = new Date(sendStartedAt.getTime() - STALE_LOCK_MS);
    const lock = await this.prisma.invoice.updateMany({
      where: {
        id: invoiceId,
        userId,
        status: "draft",
        OR: [{ sentAt: null }, { sentAt: { lt: staleThreshold } }],
      },
      data: { sentAt: sendStartedAt },
    });
    if (lock.count === 0) {
      const current = await this.findRawInvoice(userId, invoiceId);
      if (current.status === "sent") {
        if (!current.stripeCheckoutUrl || !current.qrCodeDataUrl || !current.publicShareToken) {
          throw new InternalServerErrorException(
            "Sent invoice is missing Stripe/QR data or share token",
          );
        }
        return {
          invoice: toInvoiceDto(current),
          checkoutUrl: this.buildPreviewUrl(current.publicShareToken),
          qrCodeDataUrl: current.qrCodeDataUrl,
        };
      }
      throw new ConflictException("Invoice send is already in progress");
    }

    let session: { id: string; url: string };
    let qrCodeDataUrl: string;
    let updated: InvoiceRowWithClientAndLineItems;
    let freelancer: Awaited<ReturnType<typeof this.prisma.user.findUnique>>;
    let previewUrl: string;
    try {
      freelancer = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!freelancer) throw new NotFoundException("User not found");

      const publicShareToken = randomBytes(16).toString("base64url");

      // The Raket-hosted preview page (TEA-44) is the client's entry point
      // per PRD §5. Email CTA, QR code, and API response all target this URL;
      // the preview page then forwards into Stripe Checkout (TEA-85).
      previewUrl = this.buildPreviewUrl(publicShareToken);
      // Singular `/invoice/[token]/paid` — must match the new public page route
      // and use the share token, not the internal invoice id (TEA-44).
      const successUrl = `${previewUrl}/paid`;

      session = await this.stripeService.createInvoiceCheckoutSession(
        { id: row.id, number: row.number, amount: Number(row.amount), currency: row.currency },
        body.clientEmail,
        successUrl,
      );

      // QR encodes the Raket preview URL so the client lands on our branded
      // page before being forwarded to Stripe Checkout (TEA-85, PRD §5).
      qrCodeDataUrl = await this.qrService.toDataUrl(previewUrl);

      updated = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "sent",
          publicShareToken,
          stripeCheckoutSessionId: session.id,
          // stripeCheckoutUrl stores the Stripe URL — the preview page reads
          // it to render the "Pay" anchor. Do NOT change this to previewUrl;
          // only the user-facing entry points (email/QR/API response) flip.
          stripeCheckoutUrl: session.url,
          qrCodeDataUrl,
        },
        include: { client: true, lineItems: { orderBy: { position: "asc" } } },
      });
    } catch (err) {
      // Release the lock so the user can retry without waiting for STALE_LOCK_MS.
      // Guard on sentAt: sendStartedAt so we don't clobber a lock acquired by
      // another in-flight call that legitimately won the race.
      await this.prisma.invoice
        .updateMany({
          where: { id: invoiceId, userId, status: "draft", sentAt: sendStartedAt },
          data: { sentAt: null },
        })
        .catch((releaseErr) => {
          this.logger.error(
            `Failed to release send lock for invoice ${invoiceId}: ${releaseErr instanceof Error ? releaseErr.message : releaseErr}`,
          );
        });
      throw err;
    }

    // Email failure must not roll back an already-persisted Stripe session.
    const displayName = freelancer.businessName ?? freelancer.name ?? "Your Freelancer";
    try {
      await this.emailService.sendInvoiceEmail({
        invoice: {
          number: row.number,
          amount: formatAmount(Number(row.amount)),
          currency: row.currency,
          dueDate: formatDate(row.dueDate),
          lineItems: row.lineItems.map((li) => ({
            description: li.description,
            amount: formatAmount(Number(li.amount)),
          })),
          clientName: row.client.name,
        },
        freelancer: {
          displayName,
          name: freelancer.name ?? "",
          businessName: freelancer.businessName ?? undefined,
        },
        paymentUrl: previewUrl,
        qrCodeDataUrl,
        recipientEmail: body.clientEmail,
      });
    } catch (err) {
      this.logger.error(
        `Email send failed for invoice ${row.number}: ${err instanceof Error ? err.message : err}`,
      );
    }

    // `checkoutUrl` is the freelancer's shareable link, which now routes
    // through the Raket preview page (TEA-85, PRD §5). Field name predates
    // the rename from `/pay/[invoiceId]` to `/invoice/[token]`; renaming the
    // contract field is deferred to a future bump.
    return {
      invoice: toInvoiceDto(updated),
      checkoutUrl: previewUrl,
      qrCodeDataUrl,
    };
  }

  async void(_userId: string, _invoiceId: string): Promise<Invoice> {
    throw new NotImplementedException("void: implement state transition + idempotency");
  }

  // Public read by share token. No auth — the 16-byte randomBytes token is the
  // capability. Drafts/voids/overdues are hidden behind NotFound so existence
  // of an unsent invoice doesn't leak. Mapping goes through toPublicInvoiceDto
  // which enumerates exposed fields explicitly (defense-in-depth).
  async getByPublicToken(token: string): Promise<PublicInvoiceResponse> {
    const row = await this.prisma.invoice.findUnique({
      where: { publicShareToken: token },
      include: {
        user: true,
        client: true,
        lineItems: { orderBy: { position: "asc" } },
      },
    });
    if (!row) {
      throw new NotFoundException("Invoice not found");
    }
    if (row.status !== "sent" && row.status !== "paid") {
      throw new NotFoundException("Invoice not found");
    }
    return toPublicInvoiceDto(row);
  }

  private buildPreviewUrl(publicShareToken: string): string {
    const appUrl = this.config.get("APP_URL", { infer: true });
    return `${appUrl}/invoice/${publicShareToken}`;
  }

  private async findRawInvoice(
    userId: string,
    invoiceId: string,
  ): Promise<InvoiceRowWithClientAndLineItems> {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
    });
    if (!row) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    return row;
  }
}

function isQuotationMimeType(mimetype: string): mimetype is QuotationMimeType {
  return (QUOTATION_MIME_TYPES as readonly string[]).includes(mimetype);
}

const QUOTATION_MAGIC_BYTES: Record<QuotationMimeType, readonly Buffer[]> = {
  "application/pdf": [Buffer.from("%PDF")],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
};

function matchesQuotationMagic(buf: Buffer, mime: QuotationMimeType): boolean {
  return QUOTATION_MAGIC_BYTES[mime].some((sig) => buf.subarray(0, sig.length).equals(sig));
}

function isInvoiceNumberConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  // Prisma reports target as string[] (field names) or string (constraint name)
  // depending on driver/version. Match the `number` column either way; we don't
  // retry on other unique violations so unrelated bugs still bubble.
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.includes("number");
  if (typeof target === "string") return target.includes("number");
  return false;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
