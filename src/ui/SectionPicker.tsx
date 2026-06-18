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
    key: "cookies",
    title: "Cookies",
    description: "Site sign-in data grouped by domain and encrypted in the archive.",
    icon: Cookie,
  },
  {
    key: "bookmarks",
    title: "Also include bookmarks",
    description: "Folder tree restored into a new Browser Bridge folder.",
    icon: FolderTree,
  },
  {
    key: "extensions",
    title: "Also include extension list",
    description: "List only: Chrome blocks automatic extension installs.",
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
    <div className="overflow-hidden rounded-md border bg-card sm:grid sm:grid-cols-3 sm:gap-2 sm:overflow-visible sm:border-0 sm:bg-transparent">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.key}
            className="flex min-h-[56px] cursor-pointer items-start gap-2.5 border-b p-2.5 text-left transition-[background-color,border-color,transform] duration-150 ease-out last:border-b-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-muted/40 sm:min-h-[64px] sm:rounded-md sm:border sm:bg-card"
            disabled={disabled}
            type="button"
            onClick={() => onChange({ ...value, [section.key]: !value[section.key] })}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{section.title}</span>
              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
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
