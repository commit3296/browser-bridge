import { ChromiumTargetMetadata } from "./types";

export const chromiumTargets: ChromiumTargetMetadata[] = [
  {
    id: "chrome",
    displayName: "Google Chrome",
    status: "primary",
    installNotes: "Load .output/chrome-mv3 as an unpacked extension or install the Chrome Web Store package.",
    caveats: ["Primary supported and automated QA target for this phase."],
  },
  {
    id: "edge",
    displayName: "Microsoft Edge",
    status: "compatibility",
    installNotes: "Load the Chrome MV3 output from edge://extensions with Developer mode enabled.",
    caveats: ["Manual QA required before presenting Edge as fully supported."],
  },
  {
    id: "brave",
    displayName: "Brave",
    status: "compatibility",
    installNotes: "Load the Chrome MV3 output from brave://extensions with Developer mode enabled.",
    caveats: ["Brave Shields and privacy settings can affect session behavior after import."],
  },
  {
    id: "vivaldi",
    displayName: "Vivaldi",
    status: "compatibility",
    installNotes: "Load the Chrome MV3 output from vivaldi://extensions with Developer mode enabled.",
    caveats: ["Manual QA required for side panel behavior and cookie import results."],
  },
  {
    id: "opera",
    displayName: "Opera",
    status: "compatibility",
    installNotes: "Load the Chrome MV3 output from opera://extensions with Developer mode enabled.",
    caveats: ["Manual QA required because extension UI surfaces can differ from Chrome."],
  },
];

export function getPrimaryChromiumTarget() {
  return chromiumTargets.find((target) => target.status === "primary");
}
