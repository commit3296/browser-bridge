import { browser } from "wxt/browser";
import {
  BridgeRequest,
  BridgeResponse,
  EncryptedArchiveV2,
  MigrationReportExport,
  ProgressEvent,
} from "../shared/types";
import { EncryptedArchiveV2Schema } from "../shared/schemas";

export async function sendBridgeMessage(request: BridgeRequest): Promise<BridgeResponse> {
  return browser.runtime.sendMessage(request);
}

export function createOperationId() {
  return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
}

export function downloadArchive(archive: EncryptedArchiveV2) {
  downloadJson(
    archive,
    `browser-bridge-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
}

export function downloadMigrationReport(report: MigrationReportExport) {
  downloadJson(
    report,
    `browser-bridge-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readArchiveFile(file: File) {
  const parsed = JSON.parse(await file.text());
  return EncryptedArchiveV2Schema.parse(parsed);
}

export function isProgressEvent(message: unknown): message is ProgressEvent {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "BRIDGE_PROGRESS"
  );
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
