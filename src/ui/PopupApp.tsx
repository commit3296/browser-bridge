import { ArrowRight, ShieldCheck } from "lucide-react";
import { browser } from "wxt/browser";
import { Button } from "../components/ui/button";

export function PopupApp() {
  async function openSidePanel() {
    try {
      const currentWindow = await browser.windows.getCurrent();
      if (currentWindow.id == null) throw new Error("No active browser window.");
      await browser.sidePanel.open({ windowId: currentWindow.id });
      window.close();
    } catch {
      await browser.tabs.create({ url: chrome.runtime.getURL("/sidepanel.html") });
      window.close();
    }
  }

  return (
    <main className="w-[340px] bg-background p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Encrypted Chrome transfer
      </div>
      <h1 className="mt-2 text-xl font-semibold">Browser Bridge</h1>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        Export and import bookmarks, selected cookie domains, and extension inventory.
      </p>
      <Button className="mt-4 w-full" onClick={openSidePanel}>
        Open control panel
        <ArrowRight className="h-4 w-4" />
      </Button>
    </main>
  );
}
