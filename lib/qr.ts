import "server-only";
import QRCode from "qrcode";

// QR do token: só carrega a URL /m/<token>. Cor de tinta escura para ler bem impresso.
const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#4a3b40", light: "#ffffff" } };

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, type: "svg" });
}

export function qrPng(url: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPTIONS, type: "png", width });
}
