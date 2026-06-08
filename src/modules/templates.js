import { BRANCH_COLORS } from "./config.js";
import { normalizeState } from "./state.js";

var TEMPLATE_TIME = "2026-01-01T00:00:00.000Z";

export const FREE_TEMPLATES = [
  {
    id: "basic-commit-history",
    name: "Basic Commit History",
    category: "Beginner",
    description: "A simple linear history on the main branch.",
    isPremium: false,
    tags: ["commit", "beginner", "linear"],
    graph: createBasicCommitHistory(),
    actions: [],
  },
  {
    id: "feature-branch-workflow",
    name: "Feature Branch Workflow",
    category: "Workflow",
    description: "Create a feature branch, add work, and merge it back.",
    isPremium: false,
    tags: ["branch", "merge", "beginner"],
    graph: createFeatureBranchWorkflow(),
    actions: [],
  },
  {
    id: "merge-request-flow",
    name: "Merge Request Flow",
    category: "Workflow",
    description: "Move work from a feature branch through development into main.",
    isPremium: false,
    tags: ["merge-request", "development", "team"],
    graph: createMergeRequestFlow(),
    actions: [],
  },
  {
    id: "release-tag-workflow",
    name: "Release Tag Workflow",
    category: "Release",
    description: "Merge stable work into main and mark the release with a tag.",
    isPremium: false,
    tags: ["release", "tag", "version"],
    graph: createReleaseTagWorkflow(),
    actions: [],
  },
  {
    id: "protected-branch-workflow",
    name: "Protected Branch Workflow",
    category: "Team",
    description: "A team flow with protected main, development, features, and a release tag.",
    isPremium: false,
    tags: ["team", "protected", "release"],
    graph: createProtectedBranchWorkflow(),
    actions: [],
  },
];

export const PREMIUM_TEMPLATES = [
  premiumTemplate("trunk-based-development", "Trunk-based Development", "Short-lived branches merged continuously into main.", ["trunk", "ci"]),
  premiumTemplate("rebase-vs-merge", "Rebase vs Merge", "Compare linear rebases with merge commits in one lesson.", ["rebase", "merge"]),
  premiumTemplate("automotive-release-flow", "Automotive Release Flow", "Model release trains, stabilization, and tagged milestones.", ["release", "enterprise"]),
  premiumTemplate("educator-lesson-git-merge", "Educator Lesson: Git Merge", "A guided classroom scenario for explaining merge commits.", ["teaching", "lesson"]),
  premiumTemplate("ci-cd-quality-gate-flow", "CI/CD Quality Gate Flow", "Show feature validation, quality gates, and release promotion.", ["ci", "quality"]),
];

export const ALL_TEMPLATES = FREE_TEMPLATES.concat(PREMIUM_TEMPLATES);

export function getTemplateById(templateId) {
  return ALL_TEMPLATES.find(function (template) {
    return template.id === templateId;
  });
}

export function createTemplateState(template, rootBranchName, graphOrientation) {
  if (!template || template.isPremium || !template.graph) return null;

  var nextState = cloneJson(template.graph);
  nextState.settings.rootBranchName = rootBranchName || "main";
  nextState.settings.graphOrientation = graphOrientation || "horizontal";
  var root = nextState.branches.find(function (branch) {
    return branch.id === "root";
  });
  if (root) root.name = nextState.settings.rootBranchName;
  nextState.ui = nextState.ui || {};
  nextState.ui.onboardingDismissed = true;
  nextState.ui.lastTemplateId = template.id;
  return normalizeState(nextState);
}

function premiumTemplate(id, name, description, tags) {
  return {
    id: id,
    name: name,
    category: "Pro",
    description: description,
    isPremium: true,
    tags: tags,
    graph: null,
    actions: [],
  };
}

function createState(parts) {
  var state = {
    settings: { rootBranchName: "main", graphOrientation: "horizontal" },
    branches: parts.branches,
    commits: parts.commits,
    mergeRequests: parts.mergeRequests || [],
    tags: parts.tags || [],
    actions: parts.actions,
    currentBranchId: parts.currentBranchId || "root",
    selectedCommitId: parts.selectedCommitId || null,
    ui: {
      collapsedPanels: {
        branches: false,
        mergeRequests: false,
        actionLog: false,
      },
      onboardingDismissed: true,
      lastTemplateId: parts.templateId,
    },
    counters: {
      action: parts.actions.length,
      branch: parts.branches.filter(function (branch) { return branch.id !== "root"; }).length,
      commit: parts.commits.length,
      mr: (parts.mergeRequests || []).length,
      tag: (parts.tags || []).length,
    },
  };

  return state;
}

function branch(id, name, role, headCommitId, startCommitId, lane, colorIndex) {
  return {
    id: id,
    name: name,
    role: role,
    headCommitId: headCommitId,
    startCommitId: startCommitId,
    color: BRANCH_COLORS[colorIndex % BRANCH_COLORS.length],
    lane: lane,
  };
}

function commit(id, message, branchId, parents, seq) {
  return {
    id: id,
    message: message,
    branchId: branchId,
    parents: parents,
    createdAt: TEMPLATE_TIME,
    seq: seq,
  };
}

function mr(id, title, sourceBranchId, targetBranchId, status, mergeCommitId) {
  return {
    id: id,
    title: title,
    sourceBranchId: sourceBranchId,
    targetBranchId: targetBranchId,
    status: status,
    createdAt: TEMPLATE_TIME,
    mergedAt: status === "merged" ? TEMPLATE_TIME : null,
    mergeCommitId: mergeCommitId || null,
  };
}

function tag(id, name, commitId) {
  return {
    id: id,
    name: name,
    commitId: commitId,
    createdAt: TEMPLATE_TIME,
  };
}

function action(index, type, summary) {
  return {
    id: "a" + index,
    type: type,
    summary: summary,
    createdAt: TEMPLATE_TIME,
  };
}

function createBasicCommitHistory() {
  return createState({
    templateId: "basic-commit-history",
    branches: [
      branch("root", "main", "root", "c3", "c1", 0, 0),
    ],
    commits: [
      commit("c1", "initial commit", "root", [], 1),
      commit("c2", "add project files", "root", ["c1"], 2),
      commit("c3", "document workflow", "root", ["c2"], 3),
    ],
    actions: [
      action(1, "init", "Initialized repository on main"),
      action(2, "commit", "Committed c2 on main"),
      action(3, "commit", "Committed c3 on main"),
    ],
    selectedCommitId: "c3",
  });
}

function createFeatureBranchWorkflow() {
  return createState({
    templateId: "feature-branch-workflow",
    branches: [
      branch("root", "main", "root", "c4", "c1", 0, 0),
      branch("b1", "feature/login", "topic", "c3", "c1", 1, 1),
    ],
    commits: [
      commit("c1", "initial commit", "root", [], 1),
      commit("c2", "add login form", "b1", ["c1"], 2),
      commit("c3", "validate login", "b1", ["c2"], 3),
      commit("c4", "merge feature/login", "root", ["c1", "c3"], 4),
    ],
    mergeRequests: [
      mr("mr1", "Merge feature/login into main", "b1", "root", "merged", "c4"),
    ],
    actions: [
      action(1, "init", "Initialized repository on main"),
      action(2, "branch", "Created branch feature/login from main"),
      action(3, "commit", "Committed c2 and c3 on feature/login"),
      action(4, "mr", "Opened MR mr1: feature/login into main"),
      action(5, "merge", "Merged feature/login into main as c4"),
    ],
    selectedCommitId: "c4",
  });
}

function createMergeRequestFlow() {
  return createState({
    templateId: "merge-request-flow",
    branches: [
      branch("root", "main", "root", "c6", "c1", 0, 0),
      branch("b1", "development", "topic", "c5", "c1", 1, 2),
      branch("b2", "feature/search", "topic", "c4", "c2", 2, 4),
    ],
    commits: [
      commit("c1", "initial commit", "root", [], 1),
      commit("c2", "start development", "b1", ["c1"], 2),
      commit("c3", "add search page", "b2", ["c2"], 3),
      commit("c4", "refine search ranking", "b2", ["c3"], 4),
      commit("c5", "merge feature/search", "b1", ["c2", "c4"], 5),
      commit("c6", "promote development", "root", ["c1", "c5"], 6),
    ],
    mergeRequests: [
      mr("mr1", "Merge feature/search into development", "b2", "b1", "merged", "c5"),
      mr("mr2", "Merge development into main", "b1", "root", "merged", "c6"),
    ],
    actions: [
      action(1, "init", "Initialized repository on main"),
      action(2, "branch", "Created development and feature/search branches"),
      action(3, "mr", "Opened feature and release merge requests"),
      action(4, "merge", "Merged feature/search into development"),
      action(5, "merge", "Merged development into main"),
    ],
    currentBranchId: "root",
    selectedCommitId: "c6",
  });
}

function createReleaseTagWorkflow() {
  return createState({
    templateId: "release-tag-workflow",
    branches: [
      branch("root", "main", "root", "c4", "c1", 0, 0),
      branch("b1", "development", "topic", "c3", "c1", 1, 2),
    ],
    commits: [
      commit("c1", "initial commit", "root", [], 1),
      commit("c2", "stabilize release", "b1", ["c1"], 2),
      commit("c3", "final QA fixes", "b1", ["c2"], 3),
      commit("c4", "merge stable release", "root", ["c1", "c3"], 4),
    ],
    mergeRequests: [
      mr("mr1", "Merge development into main", "b1", "root", "merged", "c4"),
    ],
    tags: [
      tag("t1", "v1.0.0", "c4"),
    ],
    actions: [
      action(1, "init", "Initialized repository on main"),
      action(2, "branch", "Created development branch"),
      action(3, "merge", "Merged stable work into main"),
      action(4, "tag", "Created tag v1.0.0 on c4"),
    ],
    selectedCommitId: "c4",
  });
}

function createProtectedBranchWorkflow() {
  return createState({
    templateId: "protected-branch-workflow",
    branches: [
      branch("root", "main", "root", "c9", "c1", 0, 0),
      branch("b1", "development", "topic", "c8", "c1", 1, 2),
      branch("b2", "feature/a", "topic", "c4", "c2", 2, 3),
      branch("b3", "feature/b", "topic", "c6", "c2", 3, 4),
    ],
    commits: [
      commit("c1", "initial commit", "root", [], 1),
      commit("c2", "prepare development", "b1", ["c1"], 2),
      commit("c3", "build feature A", "b2", ["c2"], 3),
      commit("c4", "test feature A", "b2", ["c3"], 4),
      commit("c5", "build feature B", "b3", ["c2"], 5),
      commit("c6", "test feature B", "b3", ["c5"], 6),
      commit("c7", "merge feature/a", "b1", ["c2", "c4"], 7),
      commit("c8", "merge feature/b", "b1", ["c7", "c6"], 8),
      commit("c9", "release protected main", "root", ["c1", "c8"], 9),
    ],
    mergeRequests: [
      mr("mr1", "Merge feature/a into development", "b2", "b1", "merged", "c7"),
      mr("mr2", "Merge feature/b into development", "b3", "b1", "merged", "c8"),
      mr("mr3", "Merge development into main", "b1", "root", "merged", "c9"),
    ],
    tags: [
      tag("t1", "v1.0.0", "c9"),
    ],
    actions: [
      action(1, "init", "Initialized repository on main"),
      action(2, "branch", "Created protected development and feature branches"),
      action(3, "merge", "Merged feature branches into development"),
      action(4, "merge", "Merged development into main"),
      action(5, "tag", "Created release tag v1.0.0"),
    ],
    currentBranchId: "root",
    selectedCommitId: "c9",
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
