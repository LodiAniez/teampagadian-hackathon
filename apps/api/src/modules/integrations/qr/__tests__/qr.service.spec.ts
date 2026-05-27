import { describe, expect, it } from "vitest";
import { QrService } from "../qr.service";

// The PNG IHDR chunk starts at byte 8 (after the 8-byte signature).
// IHDR layout: 4-byte length, 4-byte type ("IHDR"), then 4-byte width BE,
// 4-byte height BE, etc. So width lives at bytes 16-19 of the file.
function readPngWidth(buffer: Buffer): number {
  return buffer.readUInt32BE(16);
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("QrService", () => {
  const service = new QrService();

  describe("toDataUrl", () => {
    it("returns a base64-encoded PNG data URL", async () => {
      const url = await service.toDataUrl("https://example.com/pay/abc123");

      expect(url.startsWith("data:image/png;base64,")).toBe(true);
      const png = dataUrlToBuffer(url);
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    });

    it("honors the width option", async () => {
      const url = await service.toDataUrl("https://example.com/pay/abc123", { width: 256 });

      const png = dataUrlToBuffer(url);
      expect(readPngWidth(png)).toBe(256);
    });

    it("defaults to 400px when width is omitted", async () => {
      const url = await service.toDataUrl("https://example.com/pay/abc123");

      const png = dataUrlToBuffer(url);
      expect(readPngWidth(png)).toBe(400);
    });

    it("rejects when input is empty", async () => {
      await expect(service.toDataUrl("")).rejects.toThrow();
    });
  });

  describe("toBuffer", () => {
    it("returns a Buffer with a valid PNG signature", async () => {
      const buf = await service.toBuffer("https://example.com/pay/abc123");

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    });
  });
});
