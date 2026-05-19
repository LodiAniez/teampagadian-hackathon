import { Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type {
  RequestOtpDto,
  RequestOtpResponse,
  UpdateProfileDto,
  User,
  VerifyOtpDto,
  VerifyOtpResponse,
} from "@raket/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { EnvConfig } from "../../common/config/env.schema";
import { CONTRACT_TO_PRISMA_ELECTION, toUserDto } from "./auth.mapper";

const OTP_TTL_SECONDS = 300;
const STATIC_DEMO_OTP = "123456";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly isDev: boolean;
  private readonly otpTestMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.isDev = config.get("NODE_ENV", { infer: true }) !== "production";
    this.otpTestMode = config.get("OTP_TEST", { infer: true });
  }

  async requestOtp(body: RequestOtpDto): Promise<RequestOtpResponse> {
    const { phone } = body;
    const code = this.otpTestMode
      ? STATIC_DEMO_OTP
      : Math.floor(100_000 + Math.random() * 900_000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await this.prisma.otpChallenge.create({ data: { phone, codeHash, expiresAt } });

    this.logger.log(`[MOCK SMS to ${phone}] Your Raket code: ${code}`);

    const exposeDevCode = this.isDev || this.otpTestMode;
    return {
      success: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(exposeDevCode && { devOtpCode: code }),
    };
  }

  async verifyOtp(body: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const { phone, code } = body;

    const otp = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) throw new UnauthorizedException("No active OTP");
    if (otp.expiresAt < new Date()) throw new UnauthorizedException("Expired");
    if (otp.attempts >= 5) throw new UnauthorizedException("Too many attempts");

    const valid = await bcrypt.compare(code, otp.codeHash);
    if (!valid) {
      await this.prisma.otpChallenge.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid code");
    }

    await this.prisma.otpChallenge.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !existing;

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });

    const accessToken = this.jwtService.sign({ userId: user.id, phone });
    return { user: toUserDto(user), accessToken, isNewUser };
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return toUserDto(user);
  }

  async updateProfile(userId: string, body: UpdateProfileDto): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        businessName: body.businessName,
        defaultCurrency: body.defaultCurrency,
        defaultHourlyRate: body.defaultHourlyRate,
        ...(body.bir2303Election !== undefined && {
          bir2303Election: CONTRACT_TO_PRISMA_ELECTION[body.bir2303Election],
        }),
      },
    });
    return toUserDto(updated);
  }
}
