import { BadRequestException } from "@nestjs/common";
import type { Response } from "express";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { AuthUser } from "../../../common/auth/auth-user.types";
import { ChatController } from "../chat.controller";
import { ChatService } from "../chat.service";

const USER: AuthUser = { id: "f0e1d2c3-b4a5-6e7d-8c9b-0a1b2c3d4e5f", phone: "+639170000000" };

describe("ChatController.chat", () => {
  let chat: DeepMockProxy<ChatService>;
  let controller: ChatController;
  let res: Response;

  beforeEach(() => {
    chat = mockDeep<ChatService>();
    controller = new ChatController(chat);
    res = {} as Response;
  });

  it("delegates a valid request to the service with the authenticated user's id", async () => {
    const messages = [{ role: "user", content: "Who's my biggest client?" }];

    await controller.chat(USER, { messages }, res);

    expect(chat.streamChat).toHaveBeenCalledWith(USER.id, messages, res);
  });

  it("rejects an empty message list with 400 and never reaches the service", async () => {
    await expect(controller.chat(USER, { messages: [] }, res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(chat.streamChat).not.toHaveBeenCalled();
  });

  it("rejects a body with the wrong shape", async () => {
    await expect(controller.chat(USER, { foo: "bar" }, res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(chat.streamChat).not.toHaveBeenCalled();
  });
});
