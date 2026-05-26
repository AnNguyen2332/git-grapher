import { BRANCH_COLORS, PANEL_IDS, ROOT_NAMES, STORAGE_KEY } from "./config.js";

export function nowIso() {
  return new Date().toISOString();
}

export function createInitialState(rootName) {
  var name = ROOT_NAMES.indexOf(rootName) >= 0 ? rootName : "main";
  var createdAt = nowIso();

  return {
    settings: { rootBranchName: name },
    branches: [
      {
        id: "root",
        name: name,
        role: "root",
        headCommitId: "c1",
        startCommitId: "c1",
        color: BRANCH_COLORS[0],
        lane: 0,
      },
    ],
    commits: [
      {
        id: "c1",
        message: "initial commit",
        branchId: "root",
        parents: [],
        createdAt: createdAt,
        seq: 1,
      },
    ],
    mergeRequests: [],
    tags: [],
    actions: [
      {
        id: "a1",
        type: "init",
        summary: "Initialized repository on " + name,
        createdAt: createdAt,
      },
    ],
    currentBranchId: "root",
    selectedCommitId: null,
    ui: {
      collapsedPanels: {
        branches: false,
        mergeRequests: false,
        actionLog: false,
      },
    },
    counters: {
      action: 1,
      branch: 0,
      commit: 1,
      mr: 0,
      tag: 0,
    },
  };
}

export function loadState() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState("main");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return createInitialState("main");
  }
}

export function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeState(nextState) {
  if (!nextState || !Array.isArray(nextState.branches) || !Array.isArray(nextState.commits)) {
    return createInitialState("main");
  }

  nextState.settings = nextState.settings || {};
  nextState.settings.rootBranchName = ROOT_NAMES.indexOf(nextState.settings.rootBranchName) >= 0
    ? nextState.settings.rootBranchName
    : "main";
  nextState.mergeRequests = Array.isArray(nextState.mergeRequests) ? nextState.mergeRequests : [];
  nextState.tags = Array.isArray(nextState.tags) ? nextState.tags : [];
  nextState.actions = Array.isArray(nextState.actions) ? nextState.actions : [];
  nextState.ui = nextState.ui || {};
  nextState.ui.collapsedPanels = nextState.ui.collapsedPanels || {};
  PANEL_IDS.forEach(function (panelId) {
    nextState.ui.collapsedPanels[panelId] = !!nextState.ui.collapsedPanels[panelId];
  });
  nextState.mergeRequests.forEach(function (mr) {
    if (!Object.prototype.hasOwnProperty.call(mr, "mergeCommitId")) mr.mergeCommitId = null;
  });

  var root = nextState.branches.find(function (branch) {
    return branch.id === "root";
  });

  if (!root) return createInitialState(nextState.settings.rootBranchName);

  root.role = "root";
  root.name = nextState.settings.rootBranchName;
  root.lane = 0;
  root.color = root.color || BRANCH_COLORS[0];
  root.startCommitId = root.startCommitId || "c1";

  nextState.branches.forEach(function (branch, index) {
    branch.id = branch.id || "b" + index;
    branch.name = branch.name || "branch-" + index;
    branch.role = branch.role || "topic";
    branch.color = branch.color || BRANCH_COLORS[index % BRANCH_COLORS.length];
    branch.lane = Number.isInteger(branch.lane) ? branch.lane : index;
    branch.startCommitId = branch.startCommitId || branch.headCommitId || "c1";
  });

  nextState.commits.forEach(function (commit, index) {
    commit.parents = Array.isArray(commit.parents) ? commit.parents : [];
    commit.seq = Number.isInteger(commit.seq) ? commit.seq : index + 1;
    commit.createdAt = commit.createdAt || nowIso();
  });

  var commitIds = nextState.commits.map(function (commit) {
    return commit.id;
  });
  var branchIds = nextState.branches.map(function (branch) {
    return branch.id;
  });

  if (branchIds.indexOf(nextState.currentBranchId) < 0) nextState.currentBranchId = "root";
  if (commitIds.indexOf(nextState.selectedCommitId) < 0) nextState.selectedCommitId = null;

  nextState.counters = nextState.counters || {};
  nextState.counters.commit = Math.max(nextState.commits.length, nextState.counters.commit || 0);
  nextState.counters.branch = Math.max(
    nextState.branches.filter(function (branch) {
      return branch.id !== "root";
    }).length,
    nextState.counters.branch || 0
  );
  nextState.counters.mr = Math.max(nextState.mergeRequests.length, nextState.counters.mr || 0);
  nextState.counters.tag = Math.max(nextState.tags.length, nextState.counters.tag || 0);
  nextState.counters.action = Math.max(nextState.actions.length, nextState.counters.action || 0);

  return nextState;
}

export function nextId(state, kind) {
  state.counters[kind] += 1;
  var prefixes = {
    action: "a",
    branch: "b",
    commit: "c",
    mr: "mr",
    tag: "t",
  };
  return prefixes[kind] + state.counters[kind];
}

export function validateName(value, options) {
  var name = value.trim();
  var label = options.label || "Name";
  var max = options.max || 32;

  if (!name) return { ok: false, message: label + " is required." };
  if (name.length > max) return { ok: false, message: label + " is too long." };
  if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
    return { ok: false, message: "Use letters, numbers, dot, slash, underscore or dash." };
  }

  return { ok: true, value: name };
}

export function validateBranchName(value, branches) {
  var result = validateName(value, { label: "Branch name", max: 32 });
  if (!result.ok) return result;

  var lower = result.value.toLowerCase();
  var exists = branches.some(function (branch) {
    return branch.name.toLowerCase() === lower;
  });

  if (exists) return { ok: false, message: "A branch with that name already exists." };
  if (ROOT_NAMES.indexOf(lower) >= 0) {
    return { ok: false, message: "main and master are reserved for the root branch." };
  }

  return result;
}
