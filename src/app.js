import { BRANCH_COLORS, GRAPH_ORIENTATIONS, PANEL_IDS, ROOT_NAMES } from "./modules/config.js";
import {
  createInitialState,
  loadState,
  nextId as allocateId,
  nowIso,
  saveState,
  validateBranchName as validateNewBranchName,
  validateName,
} from "./modules/state.js";
import { createChip, createTextChip, formatTime, replaceOptions, setFeedback } from "./modules/ui.js";
import { renderGraph, syncBranchAxisScroll } from "./modules/graph.js";
import { exportGraphPng } from "./modules/exportGraph.js";

var state = loadState();
var pendingDelete = null;
var editingTagId = null;
var resizeRenderTimer = null;

var els = {
  stateSummary: document.getElementById("stateSummary"),
  graphPanel: document.querySelector(".graph-panel"),
  resetButton: document.getElementById("resetButton"),
  exportGraphButton: document.getElementById("exportGraphButton"),
  currentBranchSelect: document.getElementById("currentBranchSelect"),
  branchLegend: document.getElementById("branchLegend"),
  branchList: document.getElementById("branchList"),
  mergeRequestForm: document.getElementById("mergeRequestForm"),
  mrSource: document.getElementById("mrSource"),
  mrTarget: document.getElementById("mrTarget"),
  mrTitle: document.getElementById("mrTitle"),
  mergeRequestFeedback: document.getElementById("mergeRequestFeedback"),
  mergeRequestList: document.getElementById("mergeRequestList"),
  actionLog: document.getElementById("actionLog"),
  graphScroll: document.getElementById("graphScroll"),
  branchAxis: document.getElementById("branchAxis"),
  gitGraph: document.getElementById("gitGraph"),
  openCreateBranchModal: document.getElementById("openCreateBranchModal"),
  createBranchModal: document.getElementById("createBranchModal"),
  selectedCommitDetails: document.getElementById("selectedCommitDetails"),
  selectedActions: document.getElementById("selectedActions"),
  deselectButton: document.getElementById("deselectButton"),
  createBranchForm: document.getElementById("createBranchForm"),
  branchSourceChoices: document.getElementById("branchSourceChoices"),
  branchFromEnabled: document.getElementById("branchFromEnabled"),
  branchName: document.getElementById("branchName"),
  branchFirstCommitMessage: document.getElementById("branchFirstCommitMessage"),
  createBranchFeedback: document.getElementById("createBranchFeedback"),
  openCommitModal: document.getElementById("openCommitModal"),
  commitModal: document.getElementById("commitModal"),
  commitModalContext: document.getElementById("commitModalContext"),
  commitForm: document.getElementById("commitForm"),
  commitMessage: document.getElementById("commitMessage"),
  commitFeedback: document.getElementById("commitFeedback"),
  openMergeRequestModal: document.getElementById("openMergeRequestModal"),
  mergeRequestModal: document.getElementById("mergeRequestModal"),
  openTagModal: document.getElementById("openTagModal"),
  deleteCommitButton: document.getElementById("deleteCommitButton"),
  tagModal: document.getElementById("tagModal"),
  tagModalTitle: document.getElementById("tagModalTitle"),
  tagModalContext: document.getElementById("tagModalContext"),
  tagForm: document.getElementById("tagForm"),
  tagName: document.getElementById("tagName"),
  tagFeedback: document.getElementById("tagFeedback"),
  submitTagButton: document.getElementById("submitTagButton"),
  deleteTagButton: document.getElementById("deleteTagButton"),
  deleteModal: document.getElementById("deleteModal"),
  deleteModalTitle: document.getElementById("deleteModalTitle"),
  deleteModalMessage: document.getElementById("deleteModalMessage"),
  deleteFeedback: document.getElementById("deleteFeedback"),
  confirmDeleteButton: document.getElementById("confirmDeleteButton"),
};

function nextId(kind) {
  return allocateId(state, kind);
}

function getBranch(branchId) {
  return state.branches.find(function (branch) {
    return branch.id === branchId;
  });
}

function getCommit(commitId) {
  return state.commits.find(function (commit) {
    return commit.id === commitId;
  });
}

function getSelectedCommit() {
  return getCommit(state.selectedCommitId);
}

function getCurrentBranch() {
  return getBranch(state.currentBranchId) || getBranch("root");
}

function getCommitBranches(commitId) {
  var commit = getCommit(commitId);
  if (!commit) return [];

  var branches = state.branches.filter(function (branch) {
    return branch.headCommitId === commitId;
  });

  var owningBranch = getBranch(commit.branchId);
  if (owningBranch && !branches.some(function (branch) { return branch.id === owningBranch.id; })) {
    branches.unshift(owningBranch);
  }

  return branches;
}

function getPrimaryBranchForCommit(commitId) {
  var branches = getCommitBranches(commitId);
  return branches[0] || getBranch("root");
}

function addAction(type, summary) {
  state.actions.push({
    id: nextId("action"),
    type: type,
    summary: summary,
    createdAt: nowIso(),
  });
}

function clearFeedbacks() {
  [
    els.createBranchFeedback,
    els.commitFeedback,
    els.mergeRequestFeedback,
    els.tagFeedback,
    els.deleteFeedback,
  ].forEach(function (element) {
    setFeedback(element, "", null);
  });
}

function openModal(modal) {
  if (!modal) return;
  clearFeedbacks();
  modal.hidden = false;

  window.setTimeout(function () {
    var firstField = modal.querySelector("input:not([type='radio']), select");
    if (firstField) firstField.focus();
  }, 0);
}

function closeModal(modal) {
  if (!modal) return;
  var dialog = modal.querySelector(".modal");
  if (dialog) dialog.classList.remove("is-attention");
  modal.hidden = true;
}

function closeAllModals() {
  [
    els.createBranchModal,
    els.commitModal,
    els.mergeRequestModal,
    els.tagModal,
    els.deleteModal,
  ].forEach(closeModal);
}

function getOpenModal() {
  return [
    els.createBranchModal,
    els.commitModal,
    els.mergeRequestModal,
    els.tagModal,
    els.deleteModal,
  ].find(function (modal) {
    return modal && !modal.hidden;
  });
}

function flashModal(modal) {
  if (!modal || modal.hidden) return;
  var dialog = modal.querySelector(".modal");
  if (!dialog) return;

  dialog.classList.remove("is-attention");
  void dialog.offsetWidth;
  dialog.classList.add("is-attention");
  window.setTimeout(function () {
    dialog.classList.remove("is-attention");
  }, 520);
}

function branchOptions() {
  return state.branches.map(function (branch) {
    return { value: branch.id, text: branch.name };
  });
}

function render() {
  saveState(state);
  renderPanelState();
  renderRootSwitch();
  renderGraphOrientationSwitch();
  renderSummary();
  renderBranches();
  renderBranchSourceChoices();
  renderMergeRequestControls();
  renderMergeRequests();
  renderSelectedCommit();
  renderActionLog();
  renderGraph({ state: state, els: els, getBranch: getBranch, getCommit: getCommit });
}

function scheduleRenderAfterResize() {
  window.clearTimeout(resizeRenderTimer);
  resizeRenderTimer = window.setTimeout(render, 120);
}

function renderPanelState() {
  PANEL_IDS.forEach(function (panelId) {
    var collapsed = !!state.ui.collapsedPanels[panelId];
    var panel = document.querySelector("[data-panel='" + panelId + "']");
    var toggle = document.querySelector("[data-panel-toggle='" + panelId + "']");
    if (panel) panel.dataset.collapsed = String(collapsed);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!collapsed));
      var icon = toggle.querySelector(".panel-toggle-icon");
      if (icon) icon.textContent = collapsed ? "+" : "-";
    }
  });
}

function togglePanel(panelId) {
  if (PANEL_IDS.indexOf(panelId) < 0) return;
  state.ui.collapsedPanels[panelId] = !state.ui.collapsedPanels[panelId];
  render();
}

function renderRootSwitch() {
  document.querySelectorAll("input[name='rootBranchName']").forEach(function (input) {
    input.checked = input.value === state.settings.rootBranchName;
  });
}

function renderGraphOrientationSwitch() {
  document.querySelectorAll("input[name='graphOrientation']").forEach(function (input) {
    input.checked = input.value === state.settings.graphOrientation;
  });
}

function renderSummary() {
  var openMrs = state.mergeRequests.filter(function (mr) {
    return mr.status === "open";
  }).length;
  els.stateSummary.textContent =
    state.commits.length + " commits \u00b7 " +
    state.branches.length + " branches \u00b7 " +
    openMrs + " open merge requests";
}

function renderBranches() {
  var options = branchOptions();
  replaceOptions(els.currentBranchSelect, options, state.currentBranchId);

  els.branchLegend.replaceChildren();
  els.branchList.replaceChildren();

  state.branches.forEach(function (branch) {
    var legend = document.createElement("span");
    legend.className = "legend-chip";
    var dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = branch.color;
    legend.append(dot, document.createTextNode(branch.name));
    els.branchLegend.appendChild(legend);

    var row = document.createElement("div");
    row.className = "branch-row";
    if (branch.id !== "root") row.classList.add("has-actions");
    var body = document.createElement("div");
    var title = document.createElement("strong");
    title.textContent = branch.name;
    var meta = document.createElement("small");
    meta.textContent = "HEAD " + branch.headCommitId + " / lane " + (branch.lane + 1);
    body.append(title, meta);
    var chip = document.createElement("span");
    chip.className = branch.role === "root" ? "status-chip" : "branch-chip";
    chip.textContent = branch.role === "root" ? "root" : "branch";
    row.append(body, chip);
    if (branch.id !== "root") {
      var deleteButton = document.createElement("button");
      deleteButton.className = "button button-ghost-danger mini-button";
      deleteButton.type = "button";
      deleteButton.dataset.deleteBranchId = branch.id;
      deleteButton.textContent = "Delete";
      row.appendChild(deleteButton);
    }
    els.branchList.appendChild(row);
  });
}

function getDefaultSourceBranchId() {
  var selectedBranch = getSelectedCommit() ? getPrimaryBranchForCommit(state.selectedCommitId) : null;
  return selectedBranch ? selectedBranch.id : state.currentBranchId;
}

function syncBranchSourceMode() {
  var enabled = !els.branchFromEnabled || els.branchFromEnabled.checked;
  var sourceField = document.querySelector(".branch-source-field");
  if (sourceField) sourceField.dataset.enabled = String(enabled);
  if (els.branchSourceChoices) {
    els.branchSourceChoices.setAttribute("aria-disabled", String(!enabled));
  }
}

function renderBranchSourceChoices(forcedValue) {
  if (!els.branchSourceChoices) return;

  var checked = els.branchSourceChoices.querySelector("input[name='branchSourceId']:checked");
  var selectedValue = forcedValue || (checked ? checked.value : getDefaultSourceBranchId());

  if (!getBranch(selectedValue)) selectedValue = state.currentBranchId;

  els.branchSourceChoices.replaceChildren();
  state.branches.forEach(function (branch) {
    var label = document.createElement("label");
    var input = document.createElement("input");
    var text = document.createElement("span");
    input.type = "radio";
    input.name = "branchSourceId";
    input.value = branch.id;
    input.checked = branch.id === selectedValue;
    text.textContent = branch.name;
    label.append(input, text);
    els.branchSourceChoices.appendChild(label);
  });
  syncBranchSourceMode();
}

function renderMergeRequestControls(forceDefault) {
  var options = branchOptions();
  var defaultSource = getDefaultSourceBranchId();
  var source = state.branches.some(function (branch) {
    return branch.id === els.mrSource.value;
  }) && !forceDefault ? els.mrSource.value : defaultSource;
  var target = state.branches.some(function (branch) {
    return branch.id === els.mrTarget.value;
  }) && !forceDefault ? els.mrTarget.value : "root";

  if (source === target) {
    var firstOther = state.branches.find(function (branch) {
      return branch.id !== source;
    });
    if (firstOther) target = firstOther.id;
  }

  replaceOptions(els.mrSource, options, source);
  replaceOptions(els.mrTarget, options, target);
}

function renderMergeRequests() {
  els.mergeRequestList.replaceChildren();

  if (!state.mergeRequests.length) {
    var empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No merge requests yet.";
    els.mergeRequestList.appendChild(empty);
    return;
  }

  state.mergeRequests.slice().reverse().forEach(function (mr) {
    var source = getBranch(mr.sourceBranchId);
    var target = getBranch(mr.targetBranchId);
    var row = document.createElement("div");
    row.className = "mr-row";

    var title = document.createElement("strong");
    title.textContent = mr.title;

    var meta = document.createElement("div");
    meta.className = "mr-meta";
    meta.appendChild(createChip(source ? source.name : "missing", source ? source.color : "#999", "branch-chip"));
    meta.appendChild(createTextChip("into", "commit-chip"));
    meta.appendChild(createChip(target ? target.name : "missing", target ? target.color : "#999", "branch-chip"));
    meta.appendChild(createTextChip(mr.status, "status-chip"));

    row.append(title, meta);

    if (mr.status === "open" && getSelectedCommit()) {
      var button = document.createElement("button");
      button.className = "button button-primary";
      button.type = "button";
      button.dataset.mergeId = mr.id;
      button.textContent = "Merge";
      row.appendChild(button);
    } else if (mr.status === "open") {
      var open = document.createElement("small");
      open.textContent = "Merge action unavailable.";
      row.appendChild(open);
    } else {
      var merged = document.createElement("small");
      merged.textContent = "Merged " + formatTime(mr.mergedAt);
      row.appendChild(merged);
    }

    els.mergeRequestList.appendChild(row);
  });
}

function renderSelectedCommit() {
  var commit = getSelectedCommit();
  els.selectedCommitDetails.replaceChildren();
  els.selectedActions.hidden = !commit;
  els.deleteCommitButton.disabled = !commit || commit.parents.length === 0;
  els.deleteCommitButton.title = commit && commit.parents.length === 0
    ? "The root commit cannot be deleted."
    : "";

  if (!commit) {
    var empty = document.createElement("small");
    empty.textContent = "No commit selected.";
    els.selectedCommitDetails.appendChild(empty);
    return;
  }

  var branches = getCommitBranches(commit.id);
  var title = document.createElement("strong");
  title.textContent = commit.message;

  var meta = document.createElement("div");
  meta.className = "selected-meta";
  meta.appendChild(createTextChip(commit.id, "commit-chip"));
  branches.forEach(function (branch) {
    meta.appendChild(createChip(branch.name, branch.color, "branch-chip"));
  });
  state.tags
    .filter(function (tag) { return tag.commitId === commit.id; })
    .forEach(function (tag) {
      meta.appendChild(createTextChip(tag.name, "tag-chip"));
    });

  var parents = document.createElement("small");
  parents.textContent = commit.parents.length ? "Parents: " + commit.parents.join(", ") : "Root commit";

  els.selectedCommitDetails.append(title, meta, parents);
}

function renderActionLog() {
  els.actionLog.replaceChildren();

  state.actions.slice().reverse().slice(0, 14).forEach(function (action) {
    var item = document.createElement("li");
    var summary = document.createElement("span");
    summary.className = "action-summary";
    summary.textContent = action.summary;
    var time = document.createElement("time");
    time.dateTime = action.createdAt;
    time.textContent = formatTime(action.createdAt);
    item.append(summary, time);
    els.actionLog.appendChild(item);
  });
}

function selectCommit(commitId) {
  if (!getCommit(commitId)) return;
  state.selectedCommitId = commitId;
  var branch = getPrimaryBranchForCommit(commitId);
  if (branch) state.currentBranchId = branch.id;
  render();
}

function changeRootBranchName(rootName) {
  if (ROOT_NAMES.indexOf(rootName) < 0 || rootName === state.settings.rootBranchName) return;

  var duplicate = state.branches.some(function (branch) {
    return branch.id !== "root" && branch.name.toLowerCase() === rootName;
  });
  if (duplicate) {
    renderRootSwitch();
    return;
  }

  state.settings.rootBranchName = rootName;
  getBranch("root").name = rootName;
  addAction("root", "Renamed root branch to " + rootName);
  render();
}

function changeGraphOrientation(orientation) {
  if (GRAPH_ORIENTATIONS.indexOf(orientation) < 0 || orientation === state.settings.graphOrientation) return;
  state.settings.graphOrientation = orientation;
  addAction("layout", "Changed graph direction to " + orientation);
  render();
}

function collectDescendantCommitIds(seedIds) {
  var removed = new Set(seedIds.filter(function (commitId) {
    return !!getCommit(commitId);
  }));
  var changed = true;

  while (changed) {
    changed = false;
    state.commits.forEach(function (commit) {
      if (removed.has(commit.id)) return;
      if (commit.parents.some(function (parentId) { return removed.has(parentId); })) {
        removed.add(commit.id);
        changed = true;
      }
    });
  }

  return removed;
}

function findNearestSurvivingAncestor(commitId, removedIds) {
  var queue = [commitId];
  var seen = new Set();

  while (queue.length) {
    var currentId = queue.shift();
    if (seen.has(currentId)) continue;
    seen.add(currentId);

    var commit = getCommit(currentId);
    if (!commit) continue;
    if (!removedIds.has(currentId)) return currentId;
    commit.parents.forEach(function (parentId) {
      queue.push(parentId);
    });
  }

  return state.commits.some(function (commit) {
    return commit.id === "c1" && !removedIds.has(commit.id);
  }) ? "c1" : null;
}

function reindexBranchLanes() {
  state.branches
    .sort(function (a, b) {
      if (a.id === "root") return -1;
      if (b.id === "root") return 1;
      var seqDiff = getBranchCreationSeq(a) - getBranchCreationSeq(b);
      if (seqDiff) return seqDiff;
      return a.lane - b.lane;
    })
    .forEach(function (branch, index) {
      branch.lane = index;
    });
}

function getBranchCreationSeq(branch) {
  var ownCommit = state.commits
    .filter(function (commit) { return commit.branchId === branch.id; })
    .sort(function (a, b) { return a.seq - b.seq; })[0];
  if (ownCommit) return ownCommit.seq;

  var startCommit = getCommit(branch.startCommitId);
  return startCommit ? startCommit.seq : Number.MAX_SAFE_INTEGER;
}

function allocateNextBranchLane() {
  return Math.max.apply(null, state.branches.map(function (item) { return item.lane; })) + 1;
}

function applyCommitRemoval(removedIds, branchIdsToRemove, summary) {
  if (!removedIds.size && !branchIdsToRemove.size) return;

  var remainingCommits = state.commits.filter(function (commit) {
    return !removedIds.has(commit.id);
  });
  var remainingCommitIds = new Set(remainingCommits.map(function (commit) {
    return commit.id;
  }));
  var removedBranchIds = new Set(branchIdsToRemove);

  state.branches.forEach(function (branch) {
    if (branch.id === "root" || removedBranchIds.has(branch.id)) return;
    var hasOwnCommits = remainingCommits.some(function (commit) {
      return commit.branchId === branch.id;
    });
    if (!hasOwnCommits && removedIds.has(branch.headCommitId)) {
      removedBranchIds.add(branch.id);
    }
  });

  state.branches.forEach(function (branch) {
    if (removedBranchIds.has(branch.id)) return;

    if (!remainingCommitIds.has(branch.headCommitId)) {
      var ownHead = remainingCommits
        .filter(function (commit) { return commit.branchId === branch.id; })
        .sort(function (a, b) { return b.seq - a.seq; })[0];
      branch.headCommitId = ownHead
        ? ownHead.id
        : findNearestSurvivingAncestor(branch.headCommitId, removedIds);
    }

    if (!branch.headCommitId || !remainingCommitIds.has(branch.headCommitId)) {
      branch.headCommitId = remainingCommitIds.has("c1") ? "c1" : null;
    }

    if (!branch.startCommitId || !remainingCommitIds.has(branch.startCommitId)) {
      branch.startCommitId = branch.headCommitId || "c1";
    }
  });

  state.commits = remainingCommits;
  state.branches = state.branches.filter(function (branch) {
    return !removedBranchIds.has(branch.id);
  });
  state.tags = state.tags.filter(function (tag) {
    return !removedIds.has(tag.commitId);
  });
  state.mergeRequests = state.mergeRequests.filter(function (mr) {
    return !removedBranchIds.has(mr.sourceBranchId) &&
      !removedBranchIds.has(mr.targetBranchId) &&
      !(mr.mergeCommitId && removedIds.has(mr.mergeCommitId));
  });

  if (!getBranch(state.currentBranchId)) state.currentBranchId = "root";
  if (!getCommit(state.selectedCommitId)) state.selectedCommitId = null;

  reindexBranchLanes();
  addAction("delete", summary);
  closeModal(els.deleteModal);
  pendingDelete = null;
  render();
}

function deleteBranch(branchId) {
  var branch = getBranch(branchId);
  if (!branch || branch.id === "root") return;

  var branchCommitIds = state.commits
    .filter(function (commit) { return commit.branchId === branch.id; })
    .map(function (commit) { return commit.id; });
  var removedIds = collectDescendantCommitIds(branchCommitIds);

  applyCommitRemoval(
    removedIds,
    new Set([branch.id]),
    "Deleted branch " + branch.name + " and " + removedIds.size + " dependent commits"
  );
}

function deleteCommitSubtree(commitId) {
  var commit = getCommit(commitId);
  if (!commit || commit.parents.length === 0) return;

  var removedIds = collectDescendantCommitIds([commit.id]);
  applyCommitRemoval(
    removedIds,
    new Set(),
    "Deleted " + removedIds.size + " commits from " + commit.id + " onward"
  );
}

function openDeleteBranchModal(branchId) {
  var branch = getBranch(branchId);
  if (!branch || branch.id === "root") return;

  var branchCommitIds = state.commits
    .filter(function (commit) { return commit.branchId === branch.id; })
    .map(function (commit) { return commit.id; });
  var count = collectDescendantCommitIds(branchCommitIds).size;

  pendingDelete = { type: "branch", id: branch.id };
  els.deleteModalTitle.textContent = "Delete branch";
  els.deleteModalMessage.textContent =
    "Delete branch " + branch.name + " and " + count + " dependent commits from the graph.";
  els.confirmDeleteButton.disabled = false;
  openModal(els.deleteModal);
}

function openDeleteCommitModal() {
  var commit = getSelectedCommit();
  if (!commit) return;

  pendingDelete = { type: "commit", id: commit.id };
  els.deleteModalTitle.textContent = "Delete node";

  if (commit.parents.length === 0) {
    els.deleteModalMessage.textContent = "The root commit cannot be deleted. Use Reset to start over.";
    els.confirmDeleteButton.disabled = true;
  } else {
    var count = collectDescendantCommitIds([commit.id]).size;
    els.deleteModalMessage.textContent =
      "Delete commit " + commit.id + " and " + (count - 1) + " newer dependent commits.";
    els.confirmDeleteButton.disabled = false;
  }

  openModal(els.deleteModal);
}

function confirmDelete() {
  if (!pendingDelete) return;
  var type = pendingDelete.type;
  var id = pendingDelete.id;
  if (type === "branch") deleteBranch(id);
  else if (type === "commit") deleteCommitSubtree(id);
}

function handleCreateBranch(event) {
  event.preventDefault();
  var hadSelectedCommit = !!getSelectedCommit();
  var result = validateNewBranchName(els.branchName.value, state.branches);
  if (!result.ok) {
    setFeedback(els.createBranchFeedback, result.message, "error");
    return;
  }

  var shouldBranchFrom = !els.branchFromEnabled || els.branchFromEnabled.checked;
  var sourceBranch = null;
  var baseCommit = null;
  if (shouldBranchFrom) {
    var sourceInput = els.branchSourceChoices.querySelector("input[name='branchSourceId']:checked");
    sourceBranch = getBranch(sourceInput ? sourceInput.value : state.currentBranchId);
    if (!sourceBranch) {
      setFeedback(els.createBranchFeedback, "Choose a source branch.", "error");
      return;
    }
    baseCommit = getSelectedCommit() || getCommit(sourceBranch.headCommitId);
    if (!baseCommit) {
      setFeedback(els.createBranchFeedback, "Choose a valid source commit.", "error");
      return;
    }
  }

  var firstMessage = els.branchFirstCommitMessage.value.trim() || "create new branch";
  var branchLane = allocateNextBranchLane();
  var branch = {
    id: nextId("branch"),
    name: result.value,
    role: "topic",
    headCommitId: null,
    startCommitId: baseCommit ? baseCommit.id : null,
    color: BRANCH_COLORS[state.branches.length % BRANCH_COLORS.length],
    lane: branchLane,
  };
  var commit = {
    id: nextId("commit"),
    message: firstMessage,
    branchId: branch.id,
    parents: baseCommit ? [baseCommit.id] : [],
    createdAt: nowIso(),
    seq: state.counters.commit,
  };

  branch.headCommitId = commit.id;
  if (!branch.startCommitId) branch.startCommitId = commit.id;
  state.branches.push(branch);
  state.commits.push(commit);
  reindexBranchLanes();
  state.currentBranchId = branch.id;
  state.selectedCommitId = hadSelectedCommit ? commit.id : null;
  if (baseCommit && sourceBranch) {
    addAction(
      "branch",
      "Created branch " + branch.name + " from " + sourceBranch.name + " at " + baseCommit.id + " as " + commit.id
    );
  } else {
    addAction("branch", "Created independent branch " + branch.name + " as " + commit.id);
  }
  els.branchName.value = "";
  els.branchFirstCommitMessage.value = "create new branch";
  closeModal(els.createBranchModal);
  render();
}

function handleCreateCommit(event) {
  event.preventDefault();
  var selectedCommit = getSelectedCommit();
  if (!selectedCommit) {
    setFeedback(els.commitFeedback, "Select a commit first.", "error");
    return;
  }

  var message = els.commitMessage.value.trim();
  if (!message) {
    setFeedback(els.commitFeedback, "Commit message is required.", "error");
    return;
  }

  var branch = getPrimaryBranchForCommit(selectedCommit.id) || getCurrentBranch();
  var parentId = branch.headCommitId;
  var commit = {
    id: nextId("commit"),
    message: message,
    branchId: branch.id,
    parents: parentId ? [parentId] : [],
    createdAt: nowIso(),
    seq: state.counters.commit,
  };

  state.commits.push(commit);
  branch.headCommitId = commit.id;
  state.currentBranchId = branch.id;
  state.selectedCommitId = commit.id;
  addAction("commit", "Committed " + commit.id + " on " + branch.name);
  els.commitMessage.value = "";
  closeModal(els.commitModal);
  render();
}

function handleCreateMergeRequest(event) {
  event.preventDefault();
  var source = getBranch(els.mrSource.value);
  var target = getBranch(els.mrTarget.value);
  if (!source || !target) {
    setFeedback(els.mergeRequestFeedback, "Choose source and target branches.", "error");
    return;
  }
  if (source.id === target.id) {
    setFeedback(els.mergeRequestFeedback, "Source and target must be different.", "error");
    return;
  }

  var duplicate = state.mergeRequests.some(function (mr) {
    return mr.status === "open" && mr.sourceBranchId === source.id && mr.targetBranchId === target.id;
  });
  if (duplicate) {
    setFeedback(els.mergeRequestFeedback, "An open MR already exists for those branches.", "error");
    return;
  }

  var title = els.mrTitle.value.trim() || ("Merge " + source.name + " into " + target.name);
  var mr = {
    id: nextId("mr"),
    title: title,
    sourceBranchId: source.id,
    targetBranchId: target.id,
    status: "open",
    createdAt: nowIso(),
    mergedAt: null,
    mergeCommitId: null,
  };

  state.mergeRequests.push(mr);
  addAction("mr", "Opened MR " + mr.id + ": " + source.name + " into " + target.name);
  els.mrTitle.value = "";
  closeModal(els.mergeRequestModal);
  render();
}

function mergeRequest(mrId) {
  var mr = state.mergeRequests.find(function (item) {
    return item.id === mrId;
  });
  if (!mr || mr.status !== "open") return;

  var source = getBranch(mr.sourceBranchId);
  var target = getBranch(mr.targetBranchId);
  if (!source || !target || source.id === target.id) return;

  if (source.headCommitId === target.headCommitId) {
    setFeedback(els.mergeRequestFeedback, "Branches point to the same commit.", "error");
    return;
  }

  var commit = {
    id: nextId("commit"),
    message: "Merge branch " + source.name + " into " + target.name,
    branchId: target.id,
    parents: [target.headCommitId, source.headCommitId],
    createdAt: nowIso(),
    seq: state.counters.commit,
  };

  state.commits.push(commit);
  target.headCommitId = commit.id;
  mr.status = "merged";
  mr.mergedAt = commit.createdAt;
  mr.mergeCommitId = commit.id;
  state.currentBranchId = target.id;
  state.selectedCommitId = commit.id;
  addAction("merge", "Merged " + source.name + " into " + target.name + " as " + commit.id);
  render();
}

function handleCreateTag(event) {
  event.preventDefault();
  var existingTag = editingTagId
    ? state.tags.find(function (tag) { return tag.id === editingTagId; })
    : null;
  var target = existingTag ? getCommit(existingTag.commitId) : getSelectedCommit();
  if (!target) {
    setFeedback(els.tagFeedback, "Select a commit first.", "error");
    return;
  }

  var result = validateName(els.tagName.value, { label: "Tag name", max: 32 });
  if (!result.ok) {
    setFeedback(els.tagFeedback, result.message, "error");
    return;
  }

  var lower = result.value.toLowerCase();
  var exists = state.tags.some(function (tag) {
    return tag.id !== editingTagId && tag.name.toLowerCase() === lower;
  });
  if (exists) {
    setFeedback(els.tagFeedback, "A tag with that name already exists.", "error");
    return;
  }

  if (existingTag) {
    var oldName = existingTag.name;
    existingTag.name = result.value;
    addAction("tag", "Renamed tag " + oldName + " to " + existingTag.name);
    editingTagId = null;
    els.tagName.value = "";
    closeModal(els.tagModal);
    render();
    return;
  }

  var tag = {
    id: nextId("tag"),
    name: result.value,
    commitId: target.id,
    createdAt: nowIso(),
  };

  state.tags.push(tag);
  addAction("tag", "Created tag " + tag.name + " on " + target.id);
  els.tagName.value = "";
  closeModal(els.tagModal);
  render();
}

function deleteTag(tagId) {
  var tag = state.tags.find(function (item) {
    return item.id === tagId;
  });
  if (!tag) return;

  state.tags = state.tags.filter(function (item) {
    return item.id !== tagId;
  });
  addAction("tag", "Deleted tag " + tag.name);
  editingTagId = null;
  els.tagName.value = "";
  closeModal(els.tagModal);
  render();
}

function resetSimulator() {
  var rootName = state.settings.rootBranchName;
  var graphOrientation = state.settings.graphOrientation;
  state = createInitialState(rootName);
  state.settings.graphOrientation = graphOrientation;
  clearFeedbacks();
  render();
}

function openCreateBranchModal() {
  if (els.branchFromEnabled) els.branchFromEnabled.checked = true;
  renderBranchSourceChoices(getDefaultSourceBranchId());
  els.branchFirstCommitMessage.value = els.branchFirstCommitMessage.value || "create new branch";
  openModal(els.createBranchModal);
}

function openCommitModal() {
  var commit = getSelectedCommit();
  if (!commit) return;
  var branch = getPrimaryBranchForCommit(commit.id);
  els.commitModalContext.textContent = branch
    ? "Add commit to branch " + branch.name + "."
    : "Add commit to selected branch.";
  openModal(els.commitModal);
}

function openMergeRequestModal() {
  if (!getSelectedCommit()) return;
  renderMergeRequestControls(true);
  openModal(els.mergeRequestModal);
}

function openTagModal() {
  var commit = getSelectedCommit();
  if (!commit) return;
  editingTagId = null;
  els.tagModalTitle.textContent = "Create tag";
  els.tagName.value = "";
  els.submitTagButton.textContent = "Create tag";
  els.deleteTagButton.hidden = true;
  els.tagModalContext.textContent = "Tag selected commit " + commit.id + ".";
  openModal(els.tagModal);
}

function openEditTagModal(tagId) {
  var tag = state.tags.find(function (item) {
    return item.id === tagId;
  });
  if (!tag) return;
  var commit = getCommit(tag.commitId);
  editingTagId = tag.id;
  els.tagModalTitle.textContent = "Edit tag";
  els.tagName.value = tag.name;
  els.submitTagButton.textContent = "Save tag";
  els.deleteTagButton.hidden = false;
  els.tagModalContext.textContent = "Edit tag on commit " + (commit ? commit.id : tag.commitId) + ".";
  openModal(els.tagModal);
}

document.querySelectorAll("input[name='rootBranchName']").forEach(function (input) {
  input.addEventListener("change", function (event) {
    changeRootBranchName(event.target.value);
  });
});

document.querySelectorAll("input[name='graphOrientation']").forEach(function (input) {
  input.addEventListener("change", function (event) {
    changeGraphOrientation(event.target.value);
  });
});

els.openCreateBranchModal.addEventListener("click", openCreateBranchModal);
els.openCommitModal.addEventListener("click", openCommitModal);
els.openMergeRequestModal.addEventListener("click", openMergeRequestModal);
els.openTagModal.addEventListener("click", openTagModal);
els.deleteCommitButton.addEventListener("click", openDeleteCommitModal);
els.confirmDeleteButton.addEventListener("click", confirmDelete);
els.exportGraphButton.addEventListener("click", function () {
  exportGraphPng({ state: state, els: els, getBranch: getBranch });
});
els.graphScroll.addEventListener("scroll", function () {
  syncBranchAxisScroll(els);
});

document.querySelectorAll("[data-panel-toggle]").forEach(function (button) {
  button.addEventListener("click", function () {
    togglePanel(button.dataset.panelToggle);
  });
});

document.querySelectorAll("[data-close-modal]").forEach(function (button) {
  button.addEventListener("click", function () {
    closeAllModals();
  });
});

document.querySelectorAll(".modal-backdrop").forEach(function (backdrop) {
  backdrop.addEventListener("click", function (event) {
    if (event.target !== backdrop) return;
    event.preventDefault();
    flashModal(backdrop);
  });
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  var modal = getOpenModal();
  if (!modal) return;
  event.preventDefault();
  flashModal(modal);
});

els.currentBranchSelect.addEventListener("change", function (event) {
  state.currentBranchId = event.target.value;
  state.selectedCommitId = null;
  render();
});

els.gitGraph.addEventListener("click", function (event) {
  var tag = event.target.closest("[data-tag-id]");
  if (tag) {
    openEditTagModal(tag.dataset.tagId);
    return;
  }
  var target = event.target.closest("[data-commit-id]");
  if (target) selectCommit(target.dataset.commitId);
});

els.gitGraph.addEventListener("keydown", function (event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  var tag = event.target.closest("[data-tag-id]");
  if (tag) {
    event.preventDefault();
    openEditTagModal(tag.dataset.tagId);
    return;
  }
  var target = event.target.closest("[data-commit-id]");
  if (!target) return;
  event.preventDefault();
  selectCommit(target.dataset.commitId);
});

els.createBranchForm.addEventListener("submit", handleCreateBranch);
els.branchFromEnabled.addEventListener("change", syncBranchSourceMode);
els.commitForm.addEventListener("submit", handleCreateCommit);
els.mergeRequestForm.addEventListener("submit", handleCreateMergeRequest);
els.tagForm.addEventListener("submit", handleCreateTag);
els.deleteTagButton.addEventListener("click", function () {
  if (editingTagId) deleteTag(editingTagId);
});

els.mergeRequestList.addEventListener("click", function (event) {
  var button = event.target.closest("[data-merge-id]");
  if (button) mergeRequest(button.dataset.mergeId);
});

els.branchList.addEventListener("click", function (event) {
  var button = event.target.closest("[data-delete-branch-id]");
  if (button) openDeleteBranchModal(button.dataset.deleteBranchId);
});

els.deselectButton.addEventListener("click", function () {
  state.selectedCommitId = null;
  render();
});

els.resetButton.addEventListener("click", resetSimulator);
window.addEventListener("resize", scheduleRenderAfterResize);

reindexBranchLanes();
render();
