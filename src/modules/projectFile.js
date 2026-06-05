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

  var cicdResult = validateCicdState(projectState, branchIds);
  if (!cicdResult.ok) return cicdResult;

  return { ok: true };
}

function validateCicdState(projectState, branchIds) {
  if (!Object.prototype.hasOwnProperty.call(projectState, "cicd") || projectState.cicd == null) {
    return { ok: true };
  }

  var cicd = projectState.cicd;
  if (typeof cicd !== "object" || Array.isArray(cicd)) {
    return { ok: false, message: "Project file contains invalid CI/CD configuration." };
  }

  var requiredArrays = ["jobs", "stages", "pipelines", "assignments"];
  for (var arrayIndex = 0; arrayIndex < requiredArrays.length; arrayIndex += 1) {
    var key = requiredArrays[arrayIndex];
    if (!Array.isArray(cicd[key])) {
      return { ok: false, message: "Project file contains invalid CI/CD " + key + "." };
    }
  }

  var jobIds = collectEntityIds(cicd.jobs, "job");
  if (!jobIds.ok) return jobIds;
  var stageIds = collectEntityIds(cicd.stages, "stage");
  if (!stageIds.ok) return stageIds;
  var pipelineIds = collectEntityIds(cicd.pipelines, "pipeline");
  if (!pipelineIds.ok) return pipelineIds;

  for (var stageIndex = 0; stageIndex < cicd.stages.length; stageIndex += 1) {
    var stage = cicd.stages[stageIndex];
    if (!isNonEmptyString(stage.name)) {
      return { ok: false, message: "Project file contains a CI/CD stage without a name." };
    }
    if (!Array.isArray(stage.jobIds) || !Array.isArray(stage.dependencies)) {
      return { ok: false, message: "Project file contains invalid CI/CD stage references." };
    }
    for (var jobIndex = 0; jobIndex < stage.jobIds.length; jobIndex += 1) {
      if (!jobIds.ids.has(stage.jobIds[jobIndex])) {
        return { ok: false, message: "Project file contains a CI/CD stage with a missing job." };
      }
    }
    for (var dependencyIndex = 0; dependencyIndex < stage.dependencies.length; dependencyIndex += 1) {
      if (!stageIds.ids.has(stage.dependencies[dependencyIndex])) {
        return { ok: false, message: "Project file contains a CI/CD stage with a missing dependency." };
      }
    }
  }

  for (var pipelineIndex = 0; pipelineIndex < cicd.pipelines.length; pipelineIndex += 1) {
    var pipeline = cicd.pipelines[pipelineIndex];
    if (!isNonEmptyString(pipeline.name)) {
      return { ok: false, message: "Project file contains a CI/CD pipeline without a name." };
    }
    if (!Array.isArray(pipeline.stageIds) || !Array.isArray(pipeline.triggers)) {
      return { ok: false, message: "Project file contains invalid CI/CD pipeline references." };
    }
    for (var pipelineStageIndex = 0; pipelineStageIndex < pipeline.stageIds.length; pipelineStageIndex += 1) {
      if (!stageIds.ids.has(pipeline.stageIds[pipelineStageIndex])) {
        return { ok: false, message: "Project file contains a CI/CD pipeline with a missing stage." };
      }
    }
  }

  var mergeDotIds = new Set();
  if (Array.isArray(projectState.mergeRequests)) {
    projectState.mergeRequests.forEach(function (mr) {
      if (mr && mr.mergeCommitId) mergeDotIds.add(mr.mergeCommitId);
      if (mr && mr.id) mergeDotIds.add(mr.id);
    });
  }

  for (var assignmentIndex = 0; assignmentIndex < cicd.assignments.length; assignmentIndex += 1) {
    var assignment = cicd.assignments[assignmentIndex];
    if (!isNonEmptyString(assignment.id) || !isNonEmptyString(assignment.targetId)) {
      return { ok: false, message: "Project file contains an invalid CI/CD assignment." };
    }
    if (assignment.targetType !== "branch" && assignment.targetType !== "merge_dot") {
      return { ok: false, message: "Project file contains an unsupported CI/CD assignment target." };
    }
    if (assignment.targetType === "branch" && !branchIds.has(assignment.targetId)) {
      return { ok: false, message: "Project file contains a CI/CD assignment with a missing branch." };
    }
    if (assignment.targetType === "merge_dot" && !mergeDotIds.has(assignment.targetId)) {
      return { ok: false, message: "Project file contains a CI/CD assignment with a missing merge dot." };
    }
    if (!Array.isArray(assignment.pipelineIds) || !assignment.pipelineIds.length) {
      return { ok: false, message: "Project file contains a CI/CD assignment without pipelines." };
    }
    for (var assignmentPipelineIndex = 0; assignmentPipelineIndex < assignment.pipelineIds.length; assignmentPipelineIndex += 1) {
      if (!pipelineIds.ids.has(assignment.pipelineIds[assignmentPipelineIndex])) {
        return { ok: false, message: "Project file contains a CI/CD assignment with a missing pipeline." };
      }
    }
  }

  return { ok: true };
}

function collectEntityIds(items, label) {
  var ids = new Set();
  for (var index = 0; index < items.length; index += 1) {
    var item = items[index];
    if (!item || typeof item !== "object" || Array.isArray(item) || !isNonEmptyString(item.id)) {
      return { ok: false, message: "Project file contains invalid CI/CD " + label + " ids." };
    }
    if (!isNonEmptyString(item.name)) {
      return { ok: false, message: "Project file contains a CI/CD " + label + " without a name." };
    }
    if (ids.has(item.id)) {
      return { ok: false, message: "Project file contains duplicate CI/CD " + label + " ids." };
    }
    ids.add(item.id);
  }
  return { ok: true, ids: ids };
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
