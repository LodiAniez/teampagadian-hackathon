import { Injectable, NotImplementedException } from "@nestjs/common";
import type {
  RequestOtpBody,
  Session,
  UpdateProfileBody,
  User,
  VerifyOtpBody,
} from "@raket/contracts";

@Injectable()
export class AuthService {
  async requestOtp(_body: RequestOtpBody): Promise<{ challengeId: string; expiresAt: string }> {
    throw new NotImplementedException("OTP request: implement against Supabase Auth + mocked SMS");
  }

  async verifyOtp(_body: VerifyOtpBody): Promise<Session> {
    throw new NotImplementedException("OTP verify: implement against Supabase Auth");
  }

  async me(_userId: string): Promise<User> {
    throw new NotImplementedException("Get current user: implement against Prisma");
  }

  async updateProfile(_userId: string, _body: UpdateProfileBody): Promise<User> {
    throw new NotImplementedException("Update profile: implement against Prisma");
  }
}
