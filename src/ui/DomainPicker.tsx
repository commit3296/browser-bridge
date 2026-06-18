import { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { CookieDomainSummary } from "../shared/types";

type SortMode = "domain" | "total" | "session" | "persistent";
type CookieFilter = "session" | "persistent" | "httpOnly" | "secure";

export function DomainPicker({
  domains,
  selected,
  disabled,
  onSelectOpenTabs,
  onChange,
}: {
  domains: CookieDomainSummary[];
  selected: string[];
  disabled?: boolean;
  onSelectOpenTabs?: () => void;
  onChange: (domains: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("domain");
  const [filters, setFilters] = useState<CookieFilter[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return domains
      .filter((domain) => domain.domain.toLowerCase().includes(normalizedQuery))
      .filter((domain) => filters.every((filter) => getFilterCount(domain, filter) > 0))
      .sort((left, right) => {
        if (sortMode === "domain") return left.domain.localeCompare(right.domain);
        const delta = right[sortMode] - left[sortMode];
        return delta || left.domain.localeCompare(right.domain);
      });
  }, [domains, filters, query, sortMode]);

  function toggle(domain: string) {
    const next = new Set(selectedSet);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    onChange([...next].sort());
  }

  function toggleFilter(filter: CookieFilter) {
    setFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="space-y-2 border-b p-3">
        <input
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-ring/20"
          disabled={disabled}
          placeholder="Filter domains"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={disabled || domains.length === 0 || selected.length === domains.length}
            size="sm"
            variant="secondary"
            onClick={() => onChange(domains.map((domain) => domain.domain).sort())}
          >
            All domains
          </Button>
          <Button
            disabled={disabled || filtered.length === 0}
            size="sm"
            variant="outline"
            onClick={() => onChange(filtered.map((domain) => domain.domain).sort())}
          >
            Visible results
          </Button>
          {onSelectOpenTabs ? (
            <Button disabled={disabled} size="sm" variant="outline" onClick={onSelectOpenTabs}>
              Open tabs
            </Button>
          ) : null}
          <Button
            disabled={disabled || selected.length === 0}
            size="sm"
            variant="ghost"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-ring/20"
            disabled={disabled}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="domain">Sort: domain</option>
            <option value="total">Sort: total</option>
            <option value="session">Sort: session</option>
            <option value="persistent">Sort: persistent</option>
          </select>
          {(["session", "persistent", "httpOnly", "secure"] as const).map((filter) => (
            <button
              key={filter}
              className={`h-8 cursor-pointer rounded-md border px-2 text-xs font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                filters.includes(filter)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
              disabled={disabled}
              type="button"
              onClick={() => toggleFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-72 overflow-auto p-2 scrollbar-stable">
        {filtered.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            No matching domains
          </div>
        ) : (
          filtered.map((domain) => (
            <button
              key={domain.domain}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-[background-color,transform] duration-150 ease-out active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-muted/55"
              disabled={disabled}
              type="button"
              onClick={() => toggle(domain.domain)}
            >
              <Checkbox checked={selectedSet.has(domain.domain)} aria-label={domain.domain} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{domain.domain}</div>
                <div className="text-xs text-muted-foreground">
                  {domain.total} cookies, {domain.session} session, {domain.persistent} persistent
                </div>
              </div>
              <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                <div>{domain.httpOnly} HttpOnly · {domain.secure} Secure</div>
                <div>{formatSameSite(domain.sameSite)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function getFilterCount(domain: CookieDomainSummary, filter: CookieFilter) {
  if (filter === "session") return domain.session;
  if (filter === "persistent") return domain.persistent;
  if (filter === "httpOnly") return domain.httpOnly;
  return domain.secure;
}

function formatSameSite(values: Record<string, number>) {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}
