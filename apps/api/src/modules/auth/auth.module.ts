import { Module } from "@nestjs/common";
import { CommonAuthModule } from "../../common/auth/auth.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [CommonAuthModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
