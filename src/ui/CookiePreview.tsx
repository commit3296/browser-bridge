import { ArchivePreview } from "../shared/types";

export function CookiePreview({ preview }: { preview: ArchivePreview }) {
  if (!preview.sections.cookies) return null;

  const sortedDomains = [...preview.cookieDomains].sort((left, right) => {
    const leftRisk = (left.warnings ?? 0) + (left.toDelete ?? 0);
    const rightRisk = (right.warnings ?? 0) + (right.toDelete ?? 0);
    return rightRisk - leftRisk || right.total - left.total || left.domain.localeCompare(right.domain);
  });
  const skipped =
    preview.cookies.skipExisting +
    preview.cookies.expired +
    preview.cookies.invalid +
    preview.cookies.chromeRejectedRisk;

  return (
    <div className="mt-3 rounded-md border bg-background">
      <div className="grid grid-cols-4 border-b text-center text-xs">
        <CookieMetric label="New" value={preview.cookies.new} />
        <CookieMetric label="Overwrite" value={preview.cookies.overwrite} />
        <CookieMetric label="Skipped" value={skipped} />
        <CookieMetric label="Delete" value={preview.cookies.toDelete} />
      </div>
      <div className="max-h-64 overflow-auto scrollbar-stable">
        <table className="w-full table-fixed text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr className="[&>th]:px-1.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[10px] [&>th]:font-medium sm:[&>th]:px-2 sm:[&>th]:text-xs">
              <th className="w-[32%]">Domain</th>
              <th>Total</th>
              <th>New</th>
              <th aria-label="Overwrite">
                <span aria-hidden="true">Ovr.</span>
              </th>
              <th aria-label="Skipped">
                <span aria-hidden="true">Skip</span>
              </th>
              <th>Delete</th>
              <th aria-label="Warnings">
                <span aria-hidden="true">Warn</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains.map((domain) => (
              <tr
                key={domain.domain}
                className="border-t [&>td]:px-1.5 [&>td]:py-2 sm:[&>td]:px-2"
              >
                <td className="truncate font-medium">{domain.domain}</td>
                <td>{domain.total}</td>
                <td>{domain.new ?? 0}</td>
                <td>{domain.overwrite ?? 0}</td>
                <td>{domain.skipped ?? 0}</td>
                <td className={domain.toDelete ? "font-medium text-amber-700" : ""}>
                  {domain.toDelete ?? 0}
                </td>
                <td className={domain.warnings ? "font-medium text-amber-700" : ""}>
                  {domain.warnings ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CookieMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r p-2 last:border-r-0">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
