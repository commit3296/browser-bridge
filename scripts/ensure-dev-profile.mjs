import { mkdir, writeFile } from "node:fs/promises";

await mkdir(".wxt/chrome-profile", { recursive: true });
await writeFile(".wxt/chrome-profile/chrome-out.log", "", { flag: "a" });
