import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { createBridgeService } from "../src/background/bridge-service";
import { ProgressEvent } from "../src/shared/types";

export default defineBackground(() => {
  const service = createBridgeService({
    browser,
    emitProgress: sendProgress,
  });

  browser.runtime.onMessage.addListener((rawRequest) => {
    return service.handleMessage(rawRequest).catch((error: unknown) => ({
      ok: false,
      error: getErrorMessage(error),
    }));
  });
});

async function sendProgress(event: ProgressEvent) {
  try {
    await browser.runtime.sendMessage(event);
  } catch {
    // No active UI listener is fine; operations must continue.
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
