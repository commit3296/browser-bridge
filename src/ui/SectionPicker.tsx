import { Cookie, FolderTree, Package } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { BridgeSection, SectionSelection } from "../shared/types";

const sections: Array<{
  key: BridgeSection;
  title: string;
  description: string;
  icon: typeof FolderTree;
}> = [
  {
    key: "bookmarks",
    title: "Bookmarks",
    description: "Folder tree imported into a new Browser Bridge folder.",
    icon: FolderTree,
  },
  {
    key: "cookies",
    title: "Cookies",
    description: "Session data grouped by domain, encrypted in the archive.",
    icon: Cookie,
  },
  {
    key: "extensions",
    title: "Extensions",
    description: "Inventory only: Chrome blocks automatic extension installs.",
    icon: Package,
  },
];

export function SectionPicker({
  sections: value,
  disabled,
  onChange,
}: {
  sections: SectionSelection;
  disabled?: boolean;
  onChange: (sections: SectionSelection) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.key}
            className="flex min-h-[92px] items-start gap-3 rounded-md border bg-card p-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 hover:bg-muted/40"
            disabled={disabled}
            type="button"
            onClick={() => onChange({ ...value, [section.key]: !value[section.key] })}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{section.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {section.description}
              </span>
            </span>
            <Checkbox checked={value[section.key]} aria-label={section.title} />
          </button>
        );
      })}
    </div>
  );
}
