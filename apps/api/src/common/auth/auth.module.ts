import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { FreshAuthGuard } from "./fresh-auth.guard";

@Module({
  providers: [AuthGuard, FreshAuthGuard],
  exports: [AuthGuard, FreshAuthGuard],
})
export class CommonAuthModule {}
