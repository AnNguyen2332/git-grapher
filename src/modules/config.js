export const STORAGE_KEY = "git-action-simulator-state-v1";

export const ROOT_NAMES = ["main", "master"];
export const GRAPH_ORIENTATIONS = ["horizontal", "vertical"];

export const BRANCH_COLORS = [
  "#6B4FBB",
  "#E24329",
  "#1F75CB",
  "#108548",
  "#B46200",
  "#737278",
  "#4D3991",
  "#C5300F",
];

export const PANEL_IDS = ["branches", "mergeRequests", "actionLog"];

export const GRAPH_LAYOUT = {
  commitGap: 155,
  laneGap: 86,
  branchAxisWidth: 126,
  margin: { top: 88, right: 230, bottom: 92, left: 88 },
};

export const EXPORT_FILENAME = "git-graph.png";

export const PROJECT_FILE_FORMAT = "git-grapher-project";

export const PROJECT_FILE_VERSION = 1;

export const PROJECT_FILE_FILENAME = "git-grapher-project.json";
