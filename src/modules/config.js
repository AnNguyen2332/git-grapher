export const STORAGE_KEY = "git-action-simulator-state-v1";

export const ROOT_NAMES = ["main", "master"];
export const GRAPH_ORIENTATIONS = ["horizontal", "vertical"];

export const BRANCH_COLORS = [
  "#64748B",
  "#F59E0B",
  "#22C55E",
  "#ECC94B",
  "#0BC5EA",
  "#9F7AEA",
  "#38B2AC",
  "#ED64A6",
];

export const PANEL_IDS = ["branches", "mergeRequests", "actionLog"];

export const GRAPH_LAYOUT = {
  commitGap: 155,
  laneGap: 86,
  branchAxisWidth: 126,
  margin: { top: 88, right: 230, bottom: 92, left: 88 },
};

export const EXPORT_FILENAME = "git-graph.png";
