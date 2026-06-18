import { CheckCircle2, Copy, ExternalLink, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { ExtensionInstallStatus } from "../shared/types";

export function ExtensionInventory({ items }: { items: ExtensionInstallStatus[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Extension inventory</div>
          <div className="text-xs text-muted-foreground">
            Chrome requires manual installation; Browser Bridge checks what is already present.
          </div>
        </div>
      </div>
      <div className="max-h-72 overflow-auto scrollbar-stable">
        {items.map((extension) => (
          <div
            key={extension.id}
            className="flex items-center gap-3 border-t py-3 first:border-t-0"
          >
            <StatusIcon status={extension.status} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{extension.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {extension.id} · archived {extension.version}
                {extension.installedVersion ? ` · installed ${extension.installedVersion}` : ""}
              </div>
            </div>
            <StatusBadge status={extension.status} />
            <Button
              size="icon"
              title="Copy extension ID"
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(extension.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              asChild
              size="icon"
              title="Open extension page"
              variant="ghost"
            >
              <a href={getExtensionUrl(extension)} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ExtensionInstallStatus["status"] }) {
  if (status === "missing") return <XCircle className="h-4 w-4 text-destructive" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
}

function StatusBadge({ status }: { status: ExtensionInstallStatus["status"] }) {
  const label = status.replace("_", " ");
  const tone =
    status === "missing"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : status === "installed"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <span className={`hidden rounded-md border px-2 py-1 text-xs font-medium sm:inline ${tone}`}>
      {label}
    </span>
  );
}

function getExtensionUrl(extension: ExtensionInstallStatus) {
  return (
    extension.homepageUrl ||
    `https://chromewebstore.google.com/detail/${extension.id}`
  );
}
