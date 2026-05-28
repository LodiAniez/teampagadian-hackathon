import { randomBytes } from "node:crypto";
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { Client as ClientRow } from "@prisma/client";
import type {
  CreateInvoiceBody,
  Invoice,
  InvoiceStatus,
  PaginatedResponse,
  ParseInvoiceTextBody,
  ParsedInvoiceDraft,
  SendInvoiceBody,
  SendInvoiceResponse,
} from "@raket/contracts";
import type { EnvConfig } from "@/common/config/env.schema";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EmailService } from "../integrations/email/email.service";
import { QrService } from "../integrations/qr/qr.service";
import { StripeService } from "../integrations/stripe/stripe.service";
import { InvoiceParserService } from "./invoice-parser.service";
import { toInvoiceDto, type InvoiceRowWithClientAndLineItems } from "./invoices.mapper";

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

  async send(
    userId: string,
    invoiceId: string,
    body: SendInvoiceBody,
  ): Promise<SendInvoiceResponse> {
    const row = await this.findRawInvoice(userId, invoiceId);

    if (row.status === "sent") {
      if (!row.stripeCheckoutUrl || !row.qrCodeDataUrl) {
        throw new InternalServerErrorException("Sent invoice is missing Stripe/QR data");
      }
      return {
        invoice: toInvoiceDto(row),
        checkoutUrl: row.stripeCheckoutUrl,
        qrCodeDataUrl: row.qrCodeDataUrl,
      };
    }

    if (row.status !== "draft") {
      throw new ConflictException(`Invoice cannot be sent: status is ${row.status}`);
    }

    // Optimistic lock against concurrent send() calls (network retry, double-tap,
    // StrictMode double-invoke). The first writer flips sentAt from null → now and
    // wins the right to create the Stripe session; the loser sees count=0 and
    // either returns the cached result (if the winner finished) or 409s.
    const sendStartedAt = new Date();
    const lock = await this.prisma.invoice.updateMany({
      where: { id: invoiceId, userId, status: "draft", sentAt: null },
      data: { sentAt: sendStartedAt },
    });
    if (lock.count === 0) {
      const current = await this.findRawInvoice(userId, invoiceId);
      if (current.status === "sent" && current.stripeCheckoutUrl && current.qrCodeDataUrl) {
        return {
          invoice: toInvoiceDto(current),
          checkoutUrl: current.stripeCheckoutUrl,
          qrCodeDataUrl: current.qrCodeDataUrl,
        };
      }
      throw new ConflictException("Invoice send is already in progress");
    }

    const freelancer = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!freelancer) throw new NotFoundException("User not found");

    const publicShareToken = randomBytes(16).toString("base64url");

    const appUrl = this.config.get("NEXT_PUBLIC_APP_URL", { infer: true });
    const successUrl = `${appUrl}/invoices/${invoiceId}/paid`;

    const session = await this.stripeService.createInvoiceCheckoutSession(
      { id: row.id, number: row.number, amount: Number(row.amount), currency: row.currency },
      body.clientEmail,
      successUrl,
    );

    const qrCodeDataUrl = await this.qrService.toDataUrl(session.url);

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "sent",
        publicShareToken,
        stripeCheckoutSessionId: session.id,
        stripeCheckoutUrl: session.url,
        qrCodeDataUrl,
      },
      include: { client: true, lineItems: { orderBy: { position: "asc" } } },
    });

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
        paymentUrl: session.url,
        qrCodeDataUrl,
        recipientEmail: body.clientEmail,
      });
    } catch (err) {
      this.logger.error(
        `Email send failed for invoice ${row.number}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      invoice: toInvoiceDto(updated),
      checkoutUrl: session.url,
      qrCodeDataUrl,
    };
  }

  async void(_userId: string, _invoiceId: string): Promise<Invoice> {
    throw new NotImplementedException("void: implement state transition + idempotency");
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
