import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  srcDir: ".",
  entrypointsDir: "entrypoints",
  outDir: ".output",
  manifest: {
    name: "Browser Bridge",
    description:
      "Export and import Chrome bookmarks, cookies, and extension inventory through encrypted archives.",
    permissions: ["bookmarks", "cookies", "management", "sidePanel", "tabs"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Browser Bridge",
      default_icon: {
        "16": "/icons/icon-16.png",
        "32": "/icons/icon-32.png",
        "48": "/icons/icon-48.png",
        "128": "/icons/icon-128.png",
      },
    },
    icons: {
      "16": "/icons/icon-16.png",
      "32": "/icons/icon-32.png",
      "48": "/icons/icon-48.png",
      "128": "/icons/icon-128.png",
    },
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
