import { Injectable } from "@nestjs/common";
import QRCode from "qrcode";

const QR_DEFAULTS = {
  width: 400,
  margin: 2,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#FFFFFF" },
};

export interface QrOptions {
  width?: number;
}

@Injectable()
export class QrService {
  async toDataUrl(url: string, opts?: QrOptions): Promise<string> {
    return QRCode.toDataURL(url, {
      ...QR_DEFAULTS,
      width: opts?.width ?? QR_DEFAULTS.width,
    });
  }

  async toBuffer(url: string): Promise<Buffer> {
    return QRCode.toBuffer(url, { ...QR_DEFAULTS });
  }
}
