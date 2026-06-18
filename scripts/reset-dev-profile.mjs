import { rm } from "node:fs/promises";

await rm(".wxt/chrome-profile", { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
