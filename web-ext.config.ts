import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  chromiumProfile: ".wxt/chrome-profile",
  chromiumPort: 9222,
  keepProfileChanges: true,
  startUrls: ["https://example.com", "chrome://extensions"],
  chromiumArgs: [
    "--auto-open-devtools-for-tabs=false",
    "--disable-features=DialMediaRouteProvider",
  ],
});
