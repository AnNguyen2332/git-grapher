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
import { downloadProjectFile, parseProjectFile } from "./modules/projectFile.js";
import { ALL_TEMPLATES, createTemplateState, getTemplateById } from "./modules/templates.js";
import { trackEvent, trackRouteOnce } from "./modules/analytics.js";
import {
  CICD_MAIN_TABS,
  CICD_SUB_TABS,
  formatTrigger,
  getAssignedPipelines,
  getCicdPresetConfig,
  getMergeDotId,
  getPipelineAssignmentForTarget,
  hasStageDependencyCycle,
  normalizeTriggers,
  uniqueStrings,
} from "./modules/cicd.js";

var state = loadState();
var pendingDelete = null;
var editingTagId = null;
var resizeRenderTimer = null;

var els = {
  landingPage: document.getElementById("landingPage"),
  appShell: document.getElementById("appShell"),
  stateSummary: document.getElementById("stateSummary"),
  graphPanel: document.querySelector(".graph-panel"),
  resetButton: document.getElementById("resetButton"),
  exportGraphButton: document.getElementById("exportGraphButton"),
  exportProjectButton: document.getElementById("exportProjectButton"),
  importProjectButton: document.getElementById("importProjectButton"),
  openTemplateGalleryButton: document.getElementById("openTemplateGalleryButton"),
  feedbackButton: document.getElementById("feedbackButton"),
  projectFileInput: document.getElementById("projectFileInput"),
  projectFileFeedback: document.getElementById("projectFileFeedback"),
  currentBranchSelect: document.getElementById("currentBranchSelect"),
  branchLegend: document.getElementById("branchLegend"),
  graphZoomOutButton: document.getElementById("graphZoomOutButton"),
  graphZoomInButton: document.getElementById("graphZoomInButton"),
  graphZoomResetButton: document.getElementById("graphZoomResetButton"),
  graphZoomLabel: document.getElementById("graphZoomLabel"),
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
  editorEmptyState: document.getElementById("editorEmptyState"),
  nextActionText: document.getElementById("nextActionText"),
  startBlankButton: document.getElementById("startBlankButton"),
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
  templateGalleryModal: document.getElementById("templateGalleryModal"),
  templateGalleryList: document.getElementById("templateGalleryList"),
  exportModal: document.getElementById("exportModal"),
  proModal: document.getElementById("proModal"),
  proModalContext: document.getElementById("proModalContext"),
  waitlistModal: document.getElementById("waitlistModal"),
  waitlistForm: document.getElementById("waitlistForm"),
  waitlistFeedback: document.getElementById("waitlistFeedback"),
  feedbackModal: document.getElementById("feedbackModal"),
  feedbackForm: document.getElementById("feedbackForm"),
  feedbackFormFeedback: document.getElementById("feedbackFormFeedback"),
  loadCicdPresetButton: document.getElementById("loadCicdPresetButton"),
  cicdJobForm: document.getElementById("cicdJobForm"),
  cicdJobId: document.getElementById("cicdJobId"),
  cicdJobName: document.getElementById("cicdJobName"),
  cicdJobDescription: document.getElementById("cicdJobDescription"),
  cicdJobFeedback: document.getElementById("cicdJobFeedback"),
  cicdJobCancel: document.getElementById("cicdJobCancel"),
  cicdJobList: document.getElementById("cicdJobList"),
  cicdStageForm: document.getElementById("cicdStageForm"),
  cicdStageId: document.getElementById("cicdStageId"),
  cicdStageName: document.getElementById("cicdStageName"),
  cicdStageDescription: document.getElementById("cicdStageDescription"),
  cicdStageJobs: document.getElementById("cicdStageJobs"),
  cicdStageDependencies: document.getElementById("cicdStageDependencies"),
  cicdStageSkip: document.getElementById("cicdStageSkip"),
  cicdStageFeedback: document.getElementById("cicdStageFeedback"),
  cicdStageCancel: document.getElementById("cicdStageCancel"),
  cicdStageList: document.getElementById("cicdStageList"),
  cicdPipelineForm: document.getElementById("cicdPipelineForm"),
  cicdPipelineId: document.getElementById("cicdPipelineId"),
  cicdPipelineName: document.getElementById("cicdPipelineName"),
  cicdPipelineDescription: document.getElementById("cicdPipelineDescription"),
  cicdPipelineStages: document.getElementById("cicdPipelineStages"),
  cicdTriggerMergeRequest: document.getElementById("cicdTriggerMergeRequest"),
  cicdTriggerScheduled: document.getElementById("cicdTriggerScheduled"),
  cicdScheduleMode: document.getElementById("cicdScheduleMode"),
  cicdScheduleTime: document.getElementById("cicdScheduleTime"),
  cicdScheduleDayOfWeek: document.getElementById("cicdScheduleDayOfWeek"),
  cicdScheduleDayOfMonth: document.getElementById("cicdScheduleDayOfMonth"),
  cicdScheduleCron: document.getElementById("cicdScheduleCron"),
  cicdPipelineFeedback: document.getElementById("cicdPipelineFeedback"),
  cicdPipelineCancel: document.getElementById("cicdPipelineCancel"),
  cicdPipelineList: document.getElementById("cicdPipelineList"),
  cicdAssignmentForm: document.getElementById("cicdAssignmentForm"),
  cicdAssignmentId: document.getElementById("cicdAssignmentId"),
  cicdAssignmentTargetType: document.getElementById("cicdAssignmentTargetType"),
  cicdAssignmentTarget: document.getElementById("cicdAssignmentTarget"),
  cicdAssignmentPipelines: document.getElementById("cicdAssignmentPipelines"),
  cicdAssignmentFeedback: document.getElementById("cicdAssignmentFeedback"),
  cicdAssignmentCancel: document.getElementById("cicdAssignmentCancel"),
  cicdAssignmentList: document.getElementById("cicdAssignmentList"),
};

function isAppRoute() {
  return window.location.pathname.replace(/\/+$/, "") === "/app";
}

function navigateToApp() {
  try {
    if (!isAppRoute()) window.history.pushState({}, "", "/app");
  } catch (error) {
    // Route changes are progressive enhancement; the editor can still be shown.
  }
  renderRoute();
}

function navigateToLanding() {
  try {
    if (isAppRoute()) window.history.pushState({}, "", "/");
  } catch (error) {
    // Route changes are progressive enhancement; the landing page can still be shown.
  }
  renderRoute();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderRoute() {
  var appRoute = isAppRoute();
  if (els.landingPage) els.landingPage.hidden = appRoute;
  if (els.appShell) els.appShell.hidden = !appRoute;

  if (appRoute) {
    trackRouteOnce("app_opened");
    return;
  }

  trackRouteOnce("landing_view");
}

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
    els.waitlistFeedback,
    els.feedbackFormFeedback,
    els.cicdJobFeedback,
    els.cicdStageFeedback,
    els.cicdPipelineFeedback,
    els.cicdAssignmentFeedback,
  ].forEach(function (element) {
    setFeedback(element, "", null);
  });
}

function setProjectFileFeedback(message, tone) {
  setFeedback(els.projectFileFeedback, message, tone);
}

function openModal(modal) {
  if (!modal) return;
  clearFeedbacks();
  modal.hidden = false;

  window.setTimeout(function () {
    var firstField = modal.querySelector("input:not([type='radio']):not([type='hidden']):not([name='bot-field']), textarea, select");
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
    els.templateGalleryModal,
    els.exportModal,
    els.proModal,
    els.waitlistModal,
    els.feedbackModal,
  ].forEach(closeModal);
}

function getOpenModal() {
  return [
    els.createBranchModal,
    els.commitModal,
    els.mergeRequestModal,
    els.tagModal,
    els.deleteModal,
    els.templateGalleryModal,
    els.exportModal,
    els.proModal,
    els.waitlistModal,
    els.feedbackModal,
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
  renderGraphZoomControls();
  renderSummary();
  renderBranches();
  renderBranchSourceChoices();
  renderMergeRequestControls();
  renderMergeRequests();
  renderSelectedCommit();
  renderActionLog();
  renderOnboarding();
  renderTemplateGallery();
  renderWorkspaceTabs();
  renderCicd();
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

function renderGraphZoomControls() {
  var zoom = getGraphZoom();
  if (els.graphZoomLabel) els.graphZoomLabel.textContent = Math.round(zoom * 100) + "%";
  if (els.graphZoomOutButton) els.graphZoomOutButton.disabled = zoom <= 0.65;
  if (els.graphZoomInButton) els.graphZoomInButton.disabled = zoom >= 1.8;
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
    var label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = branch.name;
    label.title = branch.name;
    legend.append(dot, label);
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

function renderOnboarding() {
  if (!els.editorEmptyState || !els.nextActionText) return;
  els.editorEmptyState.hidden = !shouldShowOnboarding();
  els.nextActionText.textContent = getNextActionText();
}

function shouldShowOnboarding() {
  return !state.ui.onboardingDismissed &&
    state.branches.length === 1 &&
    state.commits.length === 1 &&
    state.mergeRequests.length === 0 &&
    state.tags.length === 0;
}

function getNextActionText() {
  if (state.branches.length === 1) {
    return "Next: Try creating a feature branch.";
  }

  var branchNeedingCommit = state.branches.find(function (branch) {
    if (branch.id === "root") return false;
    var ownCommitCount = state.commits.filter(function (commit) {
      return commit.branchId === branch.id;
    }).length;
    return ownCommitCount <= 1;
  });
  if (branchNeedingCommit) {
    return "Next: Add a commit on " + branchNeedingCommit.name + ".";
  }

  var hasOpenMr = state.mergeRequests.some(function (mr) {
    return mr.status === "open";
  });
  if (state.branches.length > 1 && !hasOpenMr && state.mergeRequests.length === 0) {
    return "Next: Create a merge request.";
  }

  if (state.actions.length >= 5 || state.mergeRequests.some(function (mr) { return mr.status === "merged"; })) {
    return "Next: Export the graph.";
  }

  return "Next: Keep shaping the workflow.";
}

function renderTemplateGallery() {
  if (!els.templateGalleryList) return;
  els.templateGalleryList.replaceChildren();
  ALL_TEMPLATES.forEach(function (template) {
    els.templateGalleryList.appendChild(createTemplateCard(template));
  });
}

function createTemplateCard(template) {
  var card = document.createElement("article");
  card.className = "template-card";

  var header = document.createElement("header");
  var titleWrap = document.createElement("div");
  var title = document.createElement("h3");
  title.textContent = template.name;
  var category = document.createElement("span");
  category.className = "plan-chip";
  category.textContent = template.isPremium ? "Pro" : template.category;
  titleWrap.append(title);
  header.append(titleWrap, category);

  var description = document.createElement("p");
  description.textContent = template.description;

  var tags = document.createElement("div");
  tags.className = "template-tags";
  template.tags.forEach(function (tagName) {
    var tag = document.createElement("span");
    tag.className = "template-tag";
    tag.textContent = tagName;
    tags.appendChild(tag);
  });

  var button = document.createElement("button");
  button.className = template.isPremium ? "button button-primary" : "button button-secondary";
  button.type = "button";
  button.dataset.templateId = template.id;
  button.dataset.templateSource = "gallery";
  button.textContent = template.isPremium ? "Preview Pro" : "Open this scenario";

  card.append(header, description, tags, button);
  return card;
}

function renderWorkspaceTabs() {
  document.querySelectorAll("[data-main-tab]").forEach(function (button) {
    button.setAttribute("aria-selected", String(button.dataset.mainTab === state.ui.activeMainTab));
  });
  document.querySelectorAll("[data-main-tab-panel]").forEach(function (panel) {
    panel.hidden = panel.dataset.mainTabPanel !== state.ui.activeMainTab;
  });
}

function renderCicd() {
  if (!els.cicdJobList) return;
  document.querySelectorAll("[data-cicd-tab]").forEach(function (button) {
    button.setAttribute("aria-selected", String(button.dataset.cicdTab === state.ui.activeCicdTab));
  });
  document.querySelectorAll("[data-cicd-panel]").forEach(function (panel) {
    panel.hidden = panel.dataset.cicdPanel !== state.ui.activeCicdTab;
  });

  renderCicdChoices();
  renderCicdJobs();
  renderCicdStages();
  renderCicdPipelines();
  renderCicdAssignments();
}

function renderCicdChoices() {
  renderCheckboxChoices(els.cicdStageJobs, state.cicd.jobs, "stageJobIds", getCheckedValues(els.cicdStageJobs), "No jobs defined yet.");
  renderCheckboxChoices(
    els.cicdStageDependencies,
    state.cicd.stages.filter(function (stage) { return stage.id !== els.cicdStageId.value; }),
    "stageDependencyIds",
    getCheckedValues(els.cicdStageDependencies),
    "No other stages defined yet."
  );
  renderCheckboxChoices(els.cicdPipelineStages, state.cicd.stages, "pipelineStageIds", getCheckedValues(els.cicdPipelineStages), "No stages defined yet.");
  renderAssignmentTargetOptions();
  renderCheckboxChoices(els.cicdAssignmentPipelines, state.cicd.pipelines, "assignmentPipelineIds", getCheckedValues(els.cicdAssignmentPipelines), "No pipelines defined yet.");
}

function renderCheckboxChoices(container, items, name, checkedValues, emptyText) {
  if (!container) return;
  var checked = new Set(checkedValues || []);
  container.replaceChildren();
  if (!items.length) {
    var empty = document.createElement("small");
    empty.className = "empty-note";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  items.forEach(function (item) {
    var label = document.createElement("label");
    var input = document.createElement("input");
    var text = document.createElement("span");
    input.type = "checkbox";
    input.name = name;
    input.value = item.id;
    input.checked = checked.has(item.id);
    text.textContent = item.name;
    label.append(input, text);
    container.appendChild(label);
  });
}

function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked")).map(function (input) {
    return input.value;
  });
}

function renderCicdJobs() {
  els.cicdJobList.replaceChildren();
  if (!state.cicd.jobs.length) {
    appendEmpty(els.cicdJobList, "No jobs defined yet. Create jobs such as build, qac, polyspace, or send_mail.");
    return;
  }
  state.cicd.jobs.forEach(function (job) {
    var card = createCicdCard(job, "job", state.ui.selectedCicd.jobId === job.id);
    card.appendChild(createDescription(job.description));
    els.cicdJobList.appendChild(card);
  });
}

function renderCicdStages() {
  els.cicdStageList.replaceChildren();
  if (!state.cicd.stages.length) {
    appendEmpty(els.cicdStageList, "No stages defined yet. Create stages to group related CI/CD jobs.");
    return;
  }
  state.cicd.stages.forEach(function (stage) {
    var card = createCicdCard(stage, "stage", state.ui.selectedCicd.stageId === stage.id);
    card.appendChild(createDescription(stage.description));
    var meta = document.createElement("div");
    meta.className = "cicd-card-meta";
    meta.appendChild(createTextChip("Jobs: " + namesForIds(state.cicd.jobs, stage.jobIds), "commit-chip"));
    meta.appendChild(createTextChip("Depends on: " + namesForIds(state.cicd.stages, stage.dependencies), "commit-chip"));
    meta.appendChild(createTextChip(stage.skip ? "Skipped: Yes" : "Skipped: No", stage.skip ? "tag-chip" : "status-chip"));
    card.appendChild(meta);
    els.cicdStageList.appendChild(card);
  });
}

function renderCicdPipelines() {
  els.cicdPipelineList.replaceChildren();
  if (!state.cicd.pipelines.length) {
    appendEmpty(els.cicdPipelineList, "No pipelines defined yet. Create a pipeline by selecting stages and trigger rules.");
    return;
  }
  state.cicd.pipelines.forEach(function (pipeline) {
    var card = createCicdCard(pipeline, "pipeline", state.ui.selectedCicd.pipelineId === pipeline.id);
    card.appendChild(createDescription(pipeline.description));
    var meta = document.createElement("div");
    meta.className = "cicd-card-meta";
    var enabledTriggers = pipeline.triggers.filter(function (trigger) { return trigger.enabled; }).map(formatTrigger).filter(Boolean);
    meta.appendChild(createTextChip("Stages: " + namesForIds(state.cicd.stages, pipeline.stageIds), "commit-chip"));
    meta.appendChild(createTextChip("Trigger rules: " + (enabledTriggers.join(", ") || "None enabled"), enabledTriggers.length ? "status-chip" : "tag-chip"));
    card.appendChild(meta);
    card.appendChild(createPipelineFlow(pipeline));
    els.cicdPipelineList.appendChild(card);
  });
}

function renderCicdAssignments() {
  els.cicdAssignmentList.replaceChildren();
  if (!state.cicd.assignments.length) {
    appendEmpty(els.cicdAssignmentList, "No pipeline assignments yet. Assign pipelines to branches or merge dots from your Git graph.");
    return;
  }
  state.cicd.assignments.forEach(function (assignment) {
    var card = createCicdCard(assignment, "assignment", state.ui.selectedCicd.assignmentId === assignment.id, getTargetLabel(assignment.targetType, assignment.targetId));
    var meta = document.createElement("div");
    meta.className = "cicd-card-meta";
    meta.appendChild(createTextChip("Type: " + (assignment.targetType === "branch" ? "Branch" : "Merge dot"), "status-chip"));
    meta.appendChild(createTextChip("Pipelines: " + namesForIds(state.cicd.pipelines, assignment.pipelineIds), "commit-chip"));
    card.appendChild(meta);
    els.cicdAssignmentList.appendChild(card);
  });
}

function createCicdCard(entity, type, selected, titleOverride) {
  var card = document.createElement("article");
  card.className = selected ? "cicd-card is-selected" : "cicd-card";
  var header = document.createElement("div");
  header.className = "cicd-card-header";
  var title = document.createElement("h3");
  title.textContent = titleOverride || entity.name;
  var actions = document.createElement("div");
  actions.className = "cicd-card-actions";
  var edit = document.createElement("button");
  edit.className = "button button-secondary mini-button";
  edit.type = "button";
  edit.dataset.editCicdType = type;
  edit.dataset.editCicdId = entity.id;
  edit.textContent = "Edit";
  var remove = document.createElement("button");
  remove.className = "button button-ghost-danger mini-button";
  remove.type = "button";
  remove.dataset.deleteCicdType = type;
  remove.dataset.deleteCicdId = entity.id;
  remove.textContent = "Delete";
  actions.append(edit, remove);
  header.append(title, actions);
  card.appendChild(header);
  return card;
}

function createDescription(description) {
  var element = document.createElement(description ? "p" : "small");
  element.textContent = description || "No description.";
  return element;
}

function createTriggerList(pipeline) {
  var meta = document.createElement("div");
  meta.className = "cicd-card-meta";
  var enabledTriggers = pipeline.triggers.filter(function (trigger) { return trigger.enabled; }).map(formatTrigger).filter(Boolean);
  if (!enabledTriggers.length) enabledTriggers = ["No trigger rule enabled"];
  enabledTriggers.forEach(function (label) {
    meta.appendChild(createTextChip(label, "status-chip"));
  });
  return meta;
}

function createPipelineFlow(pipeline) {
  var flow = document.createElement("div");
  flow.className = "cicd-flow";
  var stages = pipeline.stageIds
    .map(function (stageId) { return getCicdStage(stageId); })
    .filter(Boolean);
  if (stages.length > 1) flow.classList.add("has-connectors");
  if (!stages.length) {
    var empty = document.createElement("small");
    empty.textContent = "No stages selected.";
    flow.appendChild(empty);
    return flow;
  }
  stages.forEach(function (stage, index) {
    var card = document.createElement("div");
    card.className = stage.skip ? "cicd-flow-stage is-skipped" : "cicd-flow-stage";
    var title = document.createElement("button");
    title.type = "button";
    title.className = "cicd-stage-title";
    title.textContent = stage.name;
    title.dataset.focusCicdType = "stage";
    title.dataset.focusCicdId = stage.id;
    var jobList = document.createElement("div");
    jobList.className = "cicd-flow-jobs";
    stage.jobIds.forEach(function (jobId) {
      var job = getCicdJob(jobId);
      if (!job) return;
      var row = document.createElement("button");
      row.type = "button";
      row.className = "cicd-job-row";
      row.dataset.focusCicdType = "job";
      row.dataset.focusCicdId = job.id;
      var name = document.createElement("span");
      name.className = "cicd-job-name";
      name.textContent = job.name;
      row.appendChild(name);
      jobList.appendChild(row);
    });
    if (!stage.jobIds.length) {
      var noJobs = document.createElement("small");
      noJobs.textContent = "No jobs";
      jobList.appendChild(noJobs);
    }
    var deps = document.createElement("small");
    deps.textContent = "Depends on: " + namesForIds(state.cicd.stages, stage.dependencies);
    card.append(title, jobList, deps);
    if (stage.skip) card.appendChild(createTextChip("Skipped", "tag-chip"));
    flow.appendChild(card);
  });
  return flow;
}

function appendEmpty(container, message) {
  var empty = document.createElement("p");
  empty.className = "empty-note";
  empty.textContent = message;
  container.appendChild(empty);
}

function namesForIds(items, ids) {
  var names = uniqueStrings(ids).map(function (id) {
    var item = items.find(function (candidate) { return candidate.id === id; });
    return item ? item.name : "missing";
  });
  return names.length ? names.join(", ") : "-";
}

function getCicdJob(jobId) {
  return state.cicd.jobs.find(function (job) { return job.id === jobId; });
}

function getCicdStage(stageId) {
  return state.cicd.stages.find(function (stage) { return stage.id === stageId; });
}

function getCicdPipeline(pipelineId) {
  return state.cicd.pipelines.find(function (pipeline) { return pipeline.id === pipelineId; });
}

function validateCicdName(value, label, items, currentId) {
  var name = value.trim();
  if (!name) return { ok: false, message: label + " is required." };
  if (name.length > 64) return { ok: false, message: label + " is too long." };
  var lower = name.toLowerCase();
  var exists = items.some(function (item) {
    return item.id !== currentId && item.name.toLowerCase() === lower;
  });
  if (exists) return { ok: false, message: label + " should be unique." };
  return { ok: true, value: name };
}

function renderAssignmentTargetOptions() {
  if (!els.cicdAssignmentTarget) return;
  var targetType = els.cicdAssignmentTargetType.value || "branch";
  var selected = els.cicdAssignmentTarget.value;
  var targets = getAssignmentTargets(targetType);
  if (!targets.some(function (target) { return target.value === selected; })) selected = targets[0] ? targets[0].value : "";
  replaceOptions(els.cicdAssignmentTarget, targets, selected);
}

function getAssignmentTargets(targetType) {
  if (targetType === "merge_dot") return getMergeDotTargets();
  return state.branches.map(function (branch) {
    return { value: branch.id, text: branch.name };
  });
}

function getMergeDotTargets() {
  return state.mergeRequests
    .filter(function (mr) { return mr.status === "merged" && (mr.mergeCommitId || mr.id); })
    .map(function (mr) {
      return { value: getMergeDotId(mr), text: getMergeDotLabel(mr) };
    });
}

function getMergeDotLabel(mr) {
  var source = getBranch(mr.sourceBranchId);
  var target = getBranch(mr.targetBranchId);
  return "MR " + (source ? source.name : "missing") + " -> " + (target ? target.name : "missing");
}

function getTargetLabel(targetType, targetId) {
  if (targetType === "branch") {
    var branch = getBranch(targetId);
    return branch ? branch.name : "Missing branch " + targetId;
  }
  var mergeRequest = state.mergeRequests.find(function (mr) {
    return getMergeDotId(mr) === targetId || mr.id === targetId;
  });
  return mergeRequest ? getMergeDotLabel(mergeRequest) : "Missing merge dot " + targetId;
}

function setMainTab(tab) {
  if (CICD_MAIN_TABS.indexOf(tab) < 0) return;
  state.ui.activeMainTab = tab;
  render();
}

function setCicdTab(tab) {
  if (CICD_SUB_TABS.indexOf(tab) < 0) return;
  state.ui.activeMainTab = "cicd";
  state.ui.activeCicdTab = tab;
  render();
}

function focusCicd(type, id) {
  var tabByType = {
    job: "jobs",
    stage: "stages",
    pipeline: "pipelines",
    assignment: "assignments",
  };
  state.ui.selectedCicd[type + "Id"] = id;
  setCicdTab(tabByType[type]);
}

function clearCicdForm(type) {
  if (type === "job") {
    els.cicdJobId.value = "";
    els.cicdJobName.value = "";
    els.cicdJobDescription.value = "";
  } else if (type === "stage") {
    els.cicdStageId.value = "";
    els.cicdStageName.value = "";
    els.cicdStageDescription.value = "";
    els.cicdStageSkip.checked = false;
    setCheckedValues(els.cicdStageJobs, []);
    setCheckedValues(els.cicdStageDependencies, []);
  } else if (type === "pipeline") {
    els.cicdPipelineId.value = "";
    els.cicdPipelineName.value = "";
    els.cicdPipelineDescription.value = "";
    setCheckedValues(els.cicdPipelineStages, []);
    els.cicdTriggerMergeRequest.checked = false;
    els.cicdTriggerScheduled.checked = false;
    els.cicdScheduleMode.value = "daily";
    els.cicdScheduleTime.value = "19:00";
    els.cicdScheduleDayOfWeek.value = "";
    els.cicdScheduleDayOfMonth.value = "";
    els.cicdScheduleCron.value = "";
  } else if (type === "assignment") {
    els.cicdAssignmentId.value = "";
    els.cicdAssignmentTargetType.value = "branch";
    setCheckedValues(els.cicdAssignmentPipelines, []);
  }
  clearFeedbacks();
  render();
}

function editCicd(type, id) {
  clearFeedbacks();
  if (type === "job") {
    var job = getCicdJob(id);
    if (!job) return;
    state.ui.selectedCicd.jobId = job.id;
    state.ui.activeMainTab = "cicd";
    state.ui.activeCicdTab = "jobs";
    render();
    els.cicdJobId.value = job.id;
    els.cicdJobName.value = job.name;
    els.cicdJobDescription.value = job.description || "";
  } else if (type === "stage") {
    var stage = getCicdStage(id);
    if (!stage) return;
    state.ui.selectedCicd.stageId = stage.id;
    state.ui.activeMainTab = "cicd";
    state.ui.activeCicdTab = "stages";
    render();
    els.cicdStageId.value = stage.id;
    els.cicdStageName.value = stage.name;
    els.cicdStageDescription.value = stage.description || "";
    els.cicdStageSkip.checked = !!stage.skip;
    setCheckedValues(els.cicdStageJobs, stage.jobIds);
    setCheckedValues(els.cicdStageDependencies, stage.dependencies);
  } else if (type === "pipeline") {
    var pipeline = getCicdPipeline(id);
    if (!pipeline) return;
    state.ui.selectedCicd.pipelineId = pipeline.id;
    state.ui.activeMainTab = "cicd";
    state.ui.activeCicdTab = "pipelines";
    render();
    els.cicdPipelineId.value = pipeline.id;
    els.cicdPipelineName.value = pipeline.name;
    els.cicdPipelineDescription.value = pipeline.description || "";
    setCheckedValues(els.cicdPipelineStages, pipeline.stageIds);
    setPipelineTriggerFields(pipeline);
  } else if (type === "assignment") {
    var assignment = state.cicd.assignments.find(function (item) { return item.id === id; });
    if (!assignment) return;
    state.ui.selectedCicd.assignmentId = assignment.id;
    state.ui.activeMainTab = "cicd";
    state.ui.activeCicdTab = "assignments";
    render();
    els.cicdAssignmentId.value = assignment.id;
    els.cicdAssignmentTargetType.value = assignment.targetType;
    renderAssignmentTargetOptions();
    els.cicdAssignmentTarget.value = assignment.targetId;
    setCheckedValues(els.cicdAssignmentPipelines, assignment.pipelineIds);
  }
}

function setCheckedValues(container, values) {
  var checked = new Set(values || []);
  if (!container) return;
  container.querySelectorAll("input[type='checkbox']").forEach(function (input) {
    input.checked = checked.has(input.value);
  });
}

function setPipelineTriggerFields(pipeline) {
  var mergeTrigger = pipeline.triggers.find(function (trigger) { return trigger.type === "on_merge_request"; });
  var scheduledTrigger = pipeline.triggers.find(function (trigger) { return trigger.type === "scheduled"; });
  var schedule = scheduledTrigger && scheduledTrigger.schedule ? scheduledTrigger.schedule : {};
  els.cicdTriggerMergeRequest.checked = !!(mergeTrigger && mergeTrigger.enabled);
  els.cicdTriggerScheduled.checked = !!(scheduledTrigger && scheduledTrigger.enabled);
  els.cicdScheduleMode.value = schedule.mode || "daily";
  els.cicdScheduleTime.value = schedule.time || "19:00";
  els.cicdScheduleDayOfWeek.value = schedule.dayOfWeek || "";
  els.cicdScheduleDayOfMonth.value = schedule.dayOfMonth || "";
  els.cicdScheduleCron.value = schedule.cron || "";
}

function saveCicdJob(event) {
  event.preventDefault();
  var id = els.cicdJobId.value;
  var result = validateCicdName(els.cicdJobName.value, "Job name", state.cicd.jobs, id);
  if (!result.ok) {
    setFeedback(els.cicdJobFeedback, result.message, "error");
    return;
  }
  var existing = getCicdJob(id);
  if (existing) {
    existing.name = result.value;
    existing.description = els.cicdJobDescription.value.trim();
    addAction("cicd", "Updated CI/CD job " + existing.name);
  } else {
    var job = { id: nextId("cicdJob"), name: result.value, description: els.cicdJobDescription.value.trim() };
    state.cicd.jobs.push(job);
    state.ui.selectedCicd.jobId = job.id;
    addAction("cicd", "Created CI/CD job " + job.name);
  }
  clearCicdForm("job");
}

function saveCicdStage(event) {
  event.preventDefault();
  var id = els.cicdStageId.value;
  var result = validateCicdName(els.cicdStageName.value, "Stage name", state.cicd.stages, id);
  if (!result.ok) {
    setFeedback(els.cicdStageFeedback, result.message, "error");
    return;
  }
  var dependencies = getCheckedValues(els.cicdStageDependencies);
  var candidateId = id || "candidate";
  if (hasStageDependencyCycle(state.cicd.stages, candidateId, dependencies)) {
    setFeedback(els.cicdStageFeedback, "Stage dependencies cannot create a cycle.", "error");
    return;
  }
  var existing = getCicdStage(id);
  if (existing) {
    existing.name = result.value;
    existing.description = els.cicdStageDescription.value.trim();
    existing.jobIds = getCheckedValues(els.cicdStageJobs);
    existing.dependencies = dependencies;
    existing.skip = els.cicdStageSkip.checked;
    addAction("cicd", "Updated CI/CD stage " + existing.name);
  } else {
    var stage = {
      id: nextId("cicdStage"),
      name: result.value,
      description: els.cicdStageDescription.value.trim(),
      jobIds: getCheckedValues(els.cicdStageJobs),
      dependencies: dependencies,
      skip: els.cicdStageSkip.checked,
    };
    state.cicd.stages.push(stage);
    state.ui.selectedCicd.stageId = stage.id;
    addAction("cicd", "Created CI/CD stage " + stage.name);
  }
  clearCicdForm("stage");
}

function saveCicdPipeline(event) {
  event.preventDefault();
  var id = els.cicdPipelineId.value;
  var result = validateCicdName(els.cicdPipelineName.value, "Pipeline name", state.cicd.pipelines, id);
  if (!result.ok) {
    setFeedback(els.cicdPipelineFeedback, result.message, "error");
    return;
  }
  var triggers = collectPipelineTriggers();
  var existing = getCicdPipeline(id);
  if (existing) {
    existing.name = result.value;
    existing.description = els.cicdPipelineDescription.value.trim();
    existing.stageIds = getCheckedValues(els.cicdPipelineStages);
    existing.triggers = triggers;
    addAction("cicd", "Updated CI/CD pipeline " + existing.name);
  } else {
    var pipeline = {
      id: nextId("cicdPipeline"),
      name: result.value,
      description: els.cicdPipelineDescription.value.trim(),
      stageIds: getCheckedValues(els.cicdPipelineStages),
      triggers: triggers,
    };
    state.cicd.pipelines.push(pipeline);
    state.ui.selectedCicd.pipelineId = pipeline.id;
    addAction("cicd", "Created CI/CD pipeline " + pipeline.name);
  }
  clearCicdForm("pipeline");
}

function collectPipelineTriggers() {
  return normalizeTriggers([
    { type: "on_merge_request", enabled: els.cicdTriggerMergeRequest.checked },
    {
      type: "scheduled",
      enabled: els.cicdTriggerScheduled.checked,
      schedule: {
        mode: els.cicdScheduleMode.value,
        time: els.cicdScheduleTime.value,
        dayOfWeek: els.cicdScheduleDayOfWeek.value,
        dayOfMonth: els.cicdScheduleDayOfMonth.value ? Number(els.cicdScheduleDayOfMonth.value) : undefined,
        cron: els.cicdScheduleCron.value,
      },
    },
  ]);
}

function saveCicdAssignment(event) {
  event.preventDefault();
  var id = els.cicdAssignmentId.value;
  var targetType = els.cicdAssignmentTargetType.value;
  var targetId = els.cicdAssignmentTarget.value;
  var pipelineIds = getCheckedValues(els.cicdAssignmentPipelines);
  if (!targetId) {
    setFeedback(els.cicdAssignmentFeedback, "Target is required.", "error");
    return;
  }
  if (!pipelineIds.length) {
    setFeedback(els.cicdAssignmentFeedback, "Select at least one pipeline.", "error");
    return;
  }
  var duplicate = state.cicd.assignments.find(function (assignment) {
    return assignment.id !== id && assignment.targetType === targetType && assignment.targetId === targetId;
  });
  if (duplicate) {
    duplicate.pipelineIds = pipelineIds;
    state.cicd.assignments = state.cicd.assignments.filter(function (assignment) { return assignment.id !== id; });
    state.ui.selectedCicd.assignmentId = duplicate.id;
    addAction("cicd", "Updated CI/CD assignment for " + getTargetLabel(targetType, targetId));
    clearCicdForm("assignment");
    return;
  }
  var existing = state.cicd.assignments.find(function (assignment) { return assignment.id === id; });
  if (existing) {
    existing.targetType = targetType;
    existing.targetId = targetId;
    existing.pipelineIds = pipelineIds;
    addAction("cicd", "Updated CI/CD assignment for " + getTargetLabel(targetType, targetId));
  } else {
    var assignment = {
      id: nextId("cicdAssignment"),
      targetType: targetType,
      targetId: targetId,
      pipelineIds: pipelineIds,
    };
    state.cicd.assignments.push(assignment);
    state.ui.selectedCicd.assignmentId = assignment.id;
    addAction("cicd", "Created CI/CD assignment for " + getTargetLabel(targetType, targetId));
  }
  clearCicdForm("assignment");
}

function deleteCicd(type, id) {
  if (type === "job") {
    var job = getCicdJob(id);
    if (!job) return;
    state.cicd.jobs = state.cicd.jobs.filter(function (item) { return item.id !== id; });
    state.cicd.stages.forEach(function (stage) {
      stage.jobIds = stage.jobIds.filter(function (jobId) { return jobId !== id; });
    });
    addAction("cicd", "Deleted CI/CD job " + job.name);
  } else if (type === "stage") {
    var stage = getCicdStage(id);
    if (!stage) return;
    state.cicd.stages = state.cicd.stages.filter(function (item) { return item.id !== id; });
    state.cicd.stages.forEach(function (item) {
      item.dependencies = item.dependencies.filter(function (stageId) { return stageId !== id; });
    });
    state.cicd.pipelines.forEach(function (pipeline) {
      pipeline.stageIds = pipeline.stageIds.filter(function (stageId) { return stageId !== id; });
    });
    addAction("cicd", "Deleted CI/CD stage " + stage.name);
  } else if (type === "pipeline") {
    var pipeline = getCicdPipeline(id);
    if (!pipeline) return;
    state.cicd.pipelines = state.cicd.pipelines.filter(function (item) { return item.id !== id; });
    state.cicd.assignments.forEach(function (assignment) {
      assignment.pipelineIds = assignment.pipelineIds.filter(function (pipelineId) { return pipelineId !== id; });
    });
    state.cicd.assignments = state.cicd.assignments.filter(function (assignment) {
      return assignment.pipelineIds.length;
    });
    addAction("cicd", "Deleted CI/CD pipeline " + pipeline.name);
  } else if (type === "assignment") {
    var assignment = state.cicd.assignments.find(function (item) { return item.id === id; });
    if (!assignment) return;
    state.cicd.assignments = state.cicd.assignments.filter(function (item) { return item.id !== id; });
    addAction("cicd", "Deleted CI/CD assignment for " + getTargetLabel(assignment.targetType, assignment.targetId));
  }
  render();
}

function loadCicdPreset() {
  state.cicd = getCicdPresetConfig();
  state.ui.activeMainTab = "cicd";
  state.ui.activeCicdTab = "pipelines";
  addAction("cicd", "Loaded starter CI/CD configuration");
  render();
}

function selectCicdGraphTarget(targetType, targetId) {
  manageCicdTarget(targetType, targetId);
}

function manageCicdTarget(targetType, targetId) {
  var assignment = getPipelineAssignmentForTarget(state.cicd, targetType, targetId);
  state.ui.activeMainTab = "cicd";
  state.ui.activeCicdTab = "assignments";
  if (assignment) {
    editCicd("assignment", assignment.id);
    return;
  }
  clearCicdForm("assignment");
  els.cicdAssignmentTargetType.value = targetType;
  renderAssignmentTargetOptions();
  els.cicdAssignmentTarget.value = targetId;
  render();
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

function getGraphZoom() {
  return typeof state.ui.graphZoom === "number" ? state.ui.graphZoom : 1;
}

function changeGraphZoom(delta) {
  state.ui.graphZoom = Math.min(1.8, Math.max(0.65, Math.round((getGraphZoom() + delta) * 100) / 100));
  render();
}

function resetGraphZoom() {
  state.ui.graphZoom = 1;
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
  state.cicd.assignments = state.cicd.assignments.filter(function (assignment) {
    if (assignment.targetType === "branch") return !removedBranchIds.has(assignment.targetId);
    return state.mergeRequests.some(function (mr) {
      return getMergeDotId(mr) === assignment.targetId || mr.id === assignment.targetId;
    });
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
  state.ui.onboardingDismissed = true;
  trackEvent("branch_created", { branch_name: branch.name, branch_id: branch.id });
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
  state.ui.onboardingDismissed = true;
  trackEvent("commit_created", { commit_id: commit.id, branch_name: branch.name });
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
  state.ui.onboardingDismissed = true;
  trackEvent("mr_created", { mr_id: mr.id, source: source.name, target: target.name });
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
  state.ui.onboardingDismissed = true;
  trackEvent("mr_merged", { mr_id: mr.id, commit_id: commit.id, source: source.name, target: target.name });
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
  state.ui.onboardingDismissed = true;
  trackEvent("tag_created", { tag_name: tag.name, commit_id: target.id });
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
  setProjectFileFeedback("", null);
  render();
}

function resetToBlankGraph(options) {
  var rootName = state.settings.rootBranchName;
  var graphOrientation = state.settings.graphOrientation;
  state = createInitialState(rootName);
  state.settings.graphOrientation = graphOrientation;
  state.ui.onboardingDismissed = !!(options && options.dismissOnboarding);
  state.ui.lastTemplateId = null;
  pendingDelete = null;
  editingTagId = null;
  clearFeedbacks();
  setProjectFileFeedback("", null);
  render();
}

function startBlankGraph() {
  state.ui.onboardingDismissed = true;
  state.ui.lastTemplateId = null;
  trackEvent("start_blank_clicked");
  render();
}

function loadTemplate(templateId, source) {
  var template = getTemplateById(templateId);
  if (!template) return;

  if (template.isPremium) {
    trackEvent("premium_template_clicked", { template_id: template.id, source: source || "unknown" });
    openProModal("Premium workflow templates");
    return;
  }

  var rootName = state.settings.rootBranchName;
  var graphOrientation = state.settings.graphOrientation;
  var nextState = createTemplateState(template, rootName, graphOrientation);
  if (!nextState) return;

  state = nextState;
  pendingDelete = null;
  editingTagId = null;
  addAction("template", "Opened template " + template.name);
  closeAllModals();
  navigateToApp();
  render();
  trackEvent("template_opened", {
    template_id: template.id,
    template_name: template.name,
    source: source || "unknown",
  });
}

function openTemplateGallery() {
  renderTemplateGallery();
  trackEvent("template_gallery_opened");
  openModal(els.templateGalleryModal);
}

function openExportModal() {
  trackEvent("export_clicked");
  openModal(els.exportModal);
}

function openProModal(feature) {
  if (els.proModalContext) {
    els.proModalContext.textContent =
      "Pro will include SVG/PDF export, high-resolution PNG, watermark removal, premium workflow templates, and presentation tools for educators.";
  }
  trackEvent("pro_modal_opened", { feature: feature || "unknown" });
  closeModal(els.exportModal);
  closeModal(els.templateGalleryModal);
  openModal(els.proModal);
}

function openWaitlistModal() {
  trackEvent("waitlist_clicked");
  closeAllModals();
  openModal(els.waitlistModal);
}

function openFeedbackModal() {
  trackEvent("feedback_clicked");
  closeAllModals();
  openModal(els.feedbackModal);
}

function submitNetlifyForm(event, successEventName, feedbackElement, successMessage) {
  event.preventDefault();
  var form = event.currentTarget;
  var submitButton = form.querySelector("button[type='submit']");
  var body = new URLSearchParams(new FormData(form)).toString();

  if (submitButton) submitButton.disabled = true;
  setFeedback(feedbackElement, "Sending...", null);

  window.fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body,
  })
    .then(function (response) {
      if (!response.ok) throw new Error("Form submission failed");
      form.reset();
      setFeedback(feedbackElement, successMessage, "success");
      trackEvent(successEventName);
    })
    .catch(function () {
      setFeedback(feedbackElement, "Could not submit right now. Try again after deployment.", "error");
    })
    .finally(function () {
      if (submitButton) submitButton.disabled = false;
    });
}

function handleExportProject() {
  try {
    downloadProjectFile(state);
    setProjectFileFeedback("Project JSON exported.", "success");
    trackEvent("json_exported");
  } catch (error) {
    setProjectFileFeedback("Could not export project JSON.", "error");
  }
}

function openProjectImportPicker() {
  setProjectFileFeedback("", null);
  els.projectFileInput.click();
}

function handleProjectFileSelected(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  file.text()
    .then(function (text) {
      var result = parseProjectFile(text);
      if (!result.ok) {
        setProjectFileFeedback(result.message, "error");
        return;
      }

      state = result.state;
      pendingDelete = null;
      clearFeedbacks();
      closeAllModals();
      render();
      setProjectFileFeedback("Project JSON imported.", "success");
      trackEvent("json_imported");
    })
    .catch(function () {
      setProjectFileFeedback("Could not read that project file.", "error");
    })
    .finally(function () {
      event.target.value = "";
    });
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
els.graphZoomOutButton.addEventListener("click", function () { changeGraphZoom(-0.1); });
els.graphZoomInButton.addEventListener("click", function () { changeGraphZoom(0.1); });
els.graphZoomResetButton.addEventListener("click", resetGraphZoom);
els.deleteCommitButton.addEventListener("click", openDeleteCommitModal);
els.confirmDeleteButton.addEventListener("click", confirmDelete);
els.openTemplateGalleryButton.addEventListener("click", openTemplateGallery);
els.feedbackButton.addEventListener("click", openFeedbackModal);
els.exportGraphButton.addEventListener("click", openExportModal);
els.exportProjectButton.addEventListener("click", handleExportProject);
els.importProjectButton.addEventListener("click", openProjectImportPicker);
els.projectFileInput.addEventListener("change", handleProjectFileSelected);
els.startBlankButton.addEventListener("click", startBlankGraph);
els.waitlistForm.addEventListener("submit", function (event) {
  submitNetlifyForm(event, "waitlist_submitted", els.waitlistFeedback, "You're on the waitlist.");
});
els.feedbackForm.addEventListener("submit", function (event) {
  submitNetlifyForm(event, "feedback_submitted", els.feedbackFormFeedback, "Thanks, feedback received.");
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

document.addEventListener("click", function (event) {
  var mainTabButton = event.target.closest("[data-main-tab]");
  if (mainTabButton) {
    event.preventDefault();
    setMainTab(mainTabButton.dataset.mainTab);
    return;
  }

  var cicdTabButton = event.target.closest("[data-cicd-tab]");
  if (cicdTabButton) {
    event.preventDefault();
    setCicdTab(cicdTabButton.dataset.cicdTab);
    return;
  }

  var editCicdButton = event.target.closest("[data-edit-cicd-type]");
  if (editCicdButton) {
    event.preventDefault();
    editCicd(editCicdButton.dataset.editCicdType, editCicdButton.dataset.editCicdId);
    return;
  }

  var deleteCicdButton = event.target.closest("[data-delete-cicd-type]");
  if (deleteCicdButton) {
    event.preventDefault();
    deleteCicd(deleteCicdButton.dataset.deleteCicdType, deleteCicdButton.dataset.deleteCicdId);
    return;
  }

  var focusCicdButton = event.target.closest("[data-focus-cicd-type]");
  if (focusCicdButton) {
    event.preventDefault();
    focusCicd(focusCicdButton.dataset.focusCicdType, focusCicdButton.dataset.focusCicdId);
    return;
  }

  var manageCicdButton = event.target.closest("[data-manage-cicd-target-type]");
  if (manageCicdButton) {
    event.preventDefault();
    manageCicdTarget(manageCicdButton.dataset.manageCicdTargetType, manageCicdButton.dataset.manageCicdTargetId);
    return;
  }

  var landingLink = event.target.closest("[data-route='landing']");
  if (landingLink) {
    event.preventDefault();
    navigateToLanding();
    return;
  }

  var routeLink = event.target.closest("[data-route='app']");
  if (routeLink) {
    event.preventDefault();
    if (routeLink.dataset.track) trackEvent(routeLink.dataset.track);
    if (routeLink.dataset.startMode === "blank") {
      resetToBlankGraph({ dismissOnboarding: true });
    }
    navigateToApp();
    return;
  }

  var scrollButton = event.target.closest("[data-scroll-target]");
  if (scrollButton) {
    event.preventDefault();
    if (scrollButton.dataset.track) trackEvent(scrollButton.dataset.track);
    var target = document.getElementById(scrollButton.dataset.scrollTarget);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  var waitlistButton = event.target.closest("[data-open-waitlist]");
  if (waitlistButton) {
    event.preventDefault();
    openWaitlistModal();
    return;
  }

  var feedbackButton = event.target.closest("[data-open-feedback]");
  if (feedbackButton) {
    event.preventDefault();
    openFeedbackModal();
    return;
  }

  var templateButton = event.target.closest("[data-template-id]");
  if (templateButton) {
    event.preventDefault();
    loadTemplate(templateButton.dataset.templateId, templateButton.dataset.templateSource);
    return;
  }

  var exportButton = event.target.closest("[data-export-option]");
  if (exportButton) {
    event.preventDefault();
    if (exportButton.dataset.exportOption === "png") {
      closeModal(els.exportModal);
      trackEvent("export_png_clicked");
      exportGraphPng({ state: state, els: els, getBranch: getBranch });
    }
    return;
  }

  var proButton = event.target.closest("[data-pro-feature]");
  if (proButton) {
    event.preventDefault();
    trackEvent("export_pro_option_clicked", { option: proButton.dataset.proFeature });
    openProModal(proButton.dataset.proFeature);
  }
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
  var cicdTarget = event.target.closest("[data-cicd-target-type]");
  if (cicdTarget) {
    event.preventDefault();
    selectCicdGraphTarget(cicdTarget.dataset.cicdTargetType, cicdTarget.dataset.cicdTargetId);
    return;
  }
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
  var cicdTarget = event.target.closest("[data-cicd-target-type]");
  if (cicdTarget) {
    event.preventDefault();
    selectCicdGraphTarget(cicdTarget.dataset.cicdTargetType, cicdTarget.dataset.cicdTargetId);
    return;
  }
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

els.branchAxis.addEventListener("click", function (event) {
  var cicdTarget = event.target.closest("[data-cicd-target-type]");
  if (!cicdTarget) return;
  selectCicdGraphTarget(cicdTarget.dataset.cicdTargetType, cicdTarget.dataset.cicdTargetId);
});

els.branchAxis.addEventListener("keydown", function (event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  var cicdTarget = event.target.closest("[data-cicd-target-type]");
  if (!cicdTarget) return;
  event.preventDefault();
  selectCicdGraphTarget(cicdTarget.dataset.cicdTargetType, cicdTarget.dataset.cicdTargetId);
});

els.createBranchForm.addEventListener("submit", handleCreateBranch);
els.branchFromEnabled.addEventListener("change", syncBranchSourceMode);
els.commitForm.addEventListener("submit", handleCreateCommit);
els.mergeRequestForm.addEventListener("submit", handleCreateMergeRequest);
els.tagForm.addEventListener("submit", handleCreateTag);
els.cicdJobForm.addEventListener("submit", saveCicdJob);
els.cicdStageForm.addEventListener("submit", saveCicdStage);
els.cicdPipelineForm.addEventListener("submit", saveCicdPipeline);
els.cicdAssignmentForm.addEventListener("submit", saveCicdAssignment);
els.cicdJobCancel.addEventListener("click", function () { clearCicdForm("job"); });
els.cicdStageCancel.addEventListener("click", function () { clearCicdForm("stage"); });
els.cicdPipelineCancel.addEventListener("click", function () { clearCicdForm("pipeline"); });
els.cicdAssignmentCancel.addEventListener("click", function () { clearCicdForm("assignment"); });
els.cicdAssignmentTargetType.addEventListener("change", function () {
  renderAssignmentTargetOptions();
});
els.loadCicdPresetButton.addEventListener("click", loadCicdPreset);
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
window.addEventListener("popstate", renderRoute);

reindexBranchLanes();
render();
renderRoute();
