import { FlaskConical, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { QaCookieSummary } from "../shared/types";
import { getErrorMessage, sendBridgeMessage } from "./bridge-client";

export function QaDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cookies, setCookies] = useState<QaCookieSummary[]>([]);

  async function runTask(task: () => Promise<string>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await task());
    } catch (taskError) {
      setError(getErrorMessage(taskError));
    } finally {
      setBusy(false);
    }
  }

  async function refreshSummary() {
    const response = await sendBridgeMessage({ type: "GET_QA_COOKIE_SUMMARY" });
    if (!response.ok || !("qaCookies" in response)) {
      throw new Error(response.ok ? "Unexpected QA cookie response." : response.error);
    }
    setCookies(response.qaCookies);
    return `Found ${response.qaCookies.reduce((total, item) => total + item.total, 0)} QA cookies.`;
  }

  return (
    <div className="rounded-md border border-dashed bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">QA diagnostics</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            runTask(async () => {
              const response = await sendBridgeMessage({ type: "CREATE_QA_COOKIES" });
              if (!response.ok || !("created" in response)) {
                throw new Error(response.ok ? "Unexpected QA create response." : response.error);
              }
              await refreshSummary();
              return `Created ${response.created} QA cookies.`;
            })
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create test cookies
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => runTask(refreshSummary)}
        >
          Refresh counts
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            runTask(async () => {
              const response = await sendBridgeMessage({
                type: "QA_DRY_RUN_PREVIEW",
                operationId: `qa-${Date.now()}`,
                password: "Browser Bridge QA",
              });
              if (!response.ok || !("preview" in response)) {
                throw new Error(response.ok ? "Unexpected QA preview response." : response.error);
              }
              return `${response.preview.cookies.total} QA cookies checked with dry run.`;
            })
          }
        >
          Quick dry run
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            runTask(async () => {
              const response = await sendBridgeMessage({ type: "CLEAR_QA_COOKIES" });
              if (!response.ok || !("cleared" in response)) {
                throw new Error(response.ok ? "Unexpected QA clear response." : response.error);
              }
              await refreshSummary();
              return `Cleared ${response.cleared} QA cookies.`;
            })
          }
        >
          <Trash2 className="h-4 w-4" />
          Clear QA cookies
        </Button>
      </div>
      {cookies.length ? (
        <div className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs scrollbar-stable">
          {cookies.map((item) => (
            <div key={item.domain} className="border-b py-2 last:border-b-0">
              <div className="font-medium">{item.domain}</div>
              <div className="text-muted-foreground">
                {item.total} total · {item.session} session · {item.persistent} persistent ·{" "}
                {item.httpOnly} HttpOnly · {item.secure} Secure
              </div>
              <div className="mt-1 truncate text-muted-foreground">{item.names.join(" · ")}</div>
            </div>
          ))}
        </div>
      ) : null}
      {message ? <div className="mt-3 text-xs text-muted-foreground">{message}</div> : null}
      {error ? <div className="mt-3 text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
