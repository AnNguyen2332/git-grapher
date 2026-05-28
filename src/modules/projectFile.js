import {
  PROJECT_FILE_FILENAME,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
} from "./config.js";
import { normalizeState, nowIso } from "./state.js";

export function buildProjectFile(state) {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    exportedAt: nowIso(),
    state: cloneJson(state),
  };
}

export function serializeProjectFile(state) {
  return JSON.stringify(buildProjectFile(state), null, 2);
}

export function downloadProjectFile(state) {
  var blob = new Blob([serializeProjectFile(state)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, PROJECT_FILE_FILENAME);
}

export function parseProjectFile(text) {
  var payload;

  try {
    payload = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: "Choose a valid JSON project file." };
  }

  var wrapperResult = validateProjectWrapper(payload);
  if (!wrapperResult.ok) return wrapperResult;

  var stateResult = validateProjectState(payload.state);
  if (!stateResult.ok) return stateResult;

  return {
    ok: true,
    state: normalizeState(cloneJson(payload.state)),
  };
}

function validateProjectWrapper(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "This is not a Git Grapher project file." };
  }

  if (payload.format !== PROJECT_FILE_FORMAT) {
    return { ok: false, message: "This is not a Git Grapher project file." };
  }

  if (payload.version !== PROJECT_FILE_VERSION) {
    return { ok: false, message: "Unsupported project file version." };
  }

  if (!payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) {
    return { ok: false, message: "Project file is missing simulator state." };
  }

  return { ok: true };
}

function validateProjectState(projectState) {
  if (!Array.isArray(projectState.branches) || !Array.isArray(projectState.commits)) {
    return { ok: false, message: "Project file is missing branches or commits." };
  }

  if (!projectState.branches.length || !projectState.commits.length) {
    return { ok: false, message: "Project file has no graph data." };
  }

  var branchIds = new Set();
  for (var branchIndex = 0; branchIndex < projectState.branches.length; branchIndex += 1) {
    var branch = projectState.branches[branchIndex];
    if (!branch || typeof branch !== "object" || Array.isArray(branch)) {
      return { ok: false, message: "Project file contains an invalid branch." };
    }
    if (!isNonEmptyString(branch.id) || branchIds.has(branch.id)) {
      return { ok: false, message: "Project file contains invalid branch ids." };
    }
    if (!isNonEmptyString(branch.name)) {
      return { ok: false, message: "Project file contains an invalid branch name." };
    }
    branchIds.add(branch.id);
  }

  if (!branchIds.has("root")) {
    return { ok: false, message: "Project file is missing the root branch." };
  }

  var commitIds = new Set();
  for (var commitIndex = 0; commitIndex < projectState.commits.length; commitIndex += 1) {
    var commit = projectState.commits[commitIndex];
    if (!commit || typeof commit !== "object" || Array.isArray(commit)) {
      return { ok: false, message: "Project file contains an invalid commit." };
    }
    if (!isNonEmptyString(commit.id) || commitIds.has(commit.id)) {
      return { ok: false, message: "Project file contains invalid commit ids." };
    }
    if (!isNonEmptyString(commit.branchId) || !branchIds.has(commit.branchId)) {
      return { ok: false, message: "Project file contains a commit with a missing branch." };
    }
    if (!Array.isArray(commit.parents)) {
      return { ok: false, message: "Project file contains a commit with invalid parents." };
    }
    commitIds.add(commit.id);
  }

  for (var parentIndex = 0; parentIndex < projectState.commits.length; parentIndex += 1) {
    var parentCommit = projectState.commits[parentIndex];
    for (var index = 0; index < parentCommit.parents.length; index += 1) {
      var parentId = parentCommit.parents[index];
      if (!isNonEmptyString(parentId) || !commitIds.has(parentId)) {
        return { ok: false, message: "Project file contains a commit with a missing parent." };
      }
    }
  }

  for (var headIndex = 0; headIndex < projectState.branches.length; headIndex += 1) {
    var headBranch = projectState.branches[headIndex];
    if (!isNonEmptyString(headBranch.headCommitId) || !commitIds.has(headBranch.headCommitId)) {
      return { ok: false, message: "Project file contains a branch with a missing HEAD." };
    }
    if (headBranch.startCommitId && !commitIds.has(headBranch.startCommitId)) {
      return { ok: false, message: "Project file contains a branch with a missing start commit." };
    }
  }

  if (Array.isArray(projectState.tags)) {
    for (var tagIndex = 0; tagIndex < projectState.tags.length; tagIndex += 1) {
      var tag = projectState.tags[tagIndex];
      if (!tag || !isNonEmptyString(tag.commitId) || !commitIds.has(tag.commitId)) {
        return { ok: false, message: "Project file contains a tag with a missing commit." };
      }
    }
  }

  if (Array.isArray(projectState.mergeRequests)) {
    for (var mrIndex = 0; mrIndex < projectState.mergeRequests.length; mrIndex += 1) {
      var mr = projectState.mergeRequests[mrIndex];
      if (!mr || !branchIds.has(mr.sourceBranchId) || !branchIds.has(mr.targetBranchId)) {
        return { ok: false, message: "Project file contains an invalid merge request." };
      }
      if (mr.mergeCommitId && !commitIds.has(mr.mergeCommitId)) {
        return { ok: false, message: "Project file contains a merge request with a missing commit." };
      }
    }
  }

  return { ok: true };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function downloadBlob(blob, filename) {
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}
