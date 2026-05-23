import { Injectable, NotFoundException, NotImplementedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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
import { PrismaService } from "../../common/prisma/prisma.service";
import { InvoiceParserService } from "./invoice-parser.service";
import { toInvoiceDto } from "./invoices.mapper";

type ListQuery = {
  cursor?: string;
  limit: number;
  status?: InvoiceStatus;
  clientId?: string;
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceParser: InvoiceParserService,
  ) {}

  async list(userId: string, query: ListQuery): Promise<PaginatedResponse<Invoice>> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.clientId ? { clientId: query.clientId } : {}),
      },
      include: { lineItems: true },
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
      include: { lineItems: true },
    });
    if (!row) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }
    return toInvoiceDto(row);
  }

  async create(userId: string, body: CreateInvoiceBody): Promise<Invoice> {
    const total = body.lineItems.reduce(
      (sum, li) => sum.add(new Prisma.Decimal(li.quantity).mul(new Prisma.Decimal(li.rate))),
      new Prisma.Decimal(0),
    );

    const created = await this.prisma.invoice.create({
      data: {
        userId,
        clientId: body.clientId,
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
      include: { lineItems: true },
    });

    return toInvoiceDto(created);
  }

  async parseText(_userId: string, body: ParseInvoiceTextBody): Promise<ParsedInvoiceDraft> {
    return this.invoiceParser.parse(body.text, body.defaultCurrency);
  }

  async send(
    _userId: string,
    _invoiceId: string,
    _body: SendInvoiceBody,
  ): Promise<SendInvoiceResponse> {
    throw new NotImplementedException(
      "send: implement Stripe Checkout + QR + Resend email — see M4 in Linear",
    );
  }

  async void(_userId: string, _invoiceId: string): Promise<Invoice> {
    throw new NotImplementedException("void: implement state transition + idempotency");
  }
}
