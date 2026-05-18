import { Injectable, NotImplementedException } from "@nestjs/common";
import type {
  RequestOtpDto,
  RequestOtpResponse,
  UpdateProfileDto,
  User,
  VerifyOtpDto,
  VerifyOtpResponse,
} from "@raket/contracts";

@Injectable()
export class AuthService {
  async requestOtp(_body: RequestOtpDto): Promise<RequestOtpResponse> {
    throw new NotImplementedException("OTP request: implement against Supabase Auth + mocked SMS");
  }

  async verifyOtp(_body: VerifyOtpDto): Promise<VerifyOtpResponse> {
    throw new NotImplementedException("OTP verify: implement against Supabase Auth");
  }

  async me(_userId: string): Promise<User> {
    throw new NotImplementedException("Get current user: implement against Prisma");
  }

  async updateProfile(_userId: string, _body: UpdateProfileDto): Promise<User> {
    throw new NotImplementedException("Update profile: implement against Prisma");
  }
}
