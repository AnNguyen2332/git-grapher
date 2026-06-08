export const CICD_MAIN_TABS = ["graph", "cicd"];
export const CICD_SUB_TABS = ["jobs", "stages", "pipelines", "assignments"];
export const CICD_TRIGGER_TYPES = ["on_merge_request", "scheduled"];
export const CICD_SCHEDULE_MODES = ["daily", "weekly", "monthly", "custom_cron"];
export const CICD_TARGET_TYPES = ["branch", "merge_dot"];

export function createEmptyCicdConfig() {
  return {
    jobs: [],
    stages: [],
    pipelines: [],
    assignments: [],
  };
}

export function normalizeCicdConfig(config) {
  var next = config && typeof config === "object" && !Array.isArray(config)
    ? config
    : createEmptyCicdConfig();

  next.jobs = Array.isArray(next.jobs) ? next.jobs : [];
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.pipelines = Array.isArray(next.pipelines) ? next.pipelines : [];
  next.assignments = Array.isArray(next.assignments) ? next.assignments : [];

  var jobIds = new Set();
  next.jobs = next.jobs
    .filter(function (job) {
      return job && typeof job === "object" && !Array.isArray(job);
    })
    .map(function (job, index) {
      var id = isNonEmptyString(job.id) ? job.id : "job-" + (index + 1);
      while (jobIds.has(id)) id += "-copy";
      jobIds.add(id);
      return {
        id: id,
        name: isNonEmptyString(job.name) ? job.name.trim() : "job-" + (index + 1),
        description: isNonEmptyString(job.description) ? job.description.trim() : "",
      };
    });

  var stageIds = new Set();
  next.stages = next.stages
    .filter(function (stage) {
      return stage && typeof stage === "object" && !Array.isArray(stage);
    })
    .map(function (stage, index) {
      var id = isNonEmptyString(stage.id) ? stage.id : "stage-" + (index + 1);
      while (stageIds.has(id)) id += "-copy";
      stageIds.add(id);
      return {
        id: id,
        name: isNonEmptyString(stage.name) ? stage.name.trim() : "stage-" + (index + 1),
        description: isNonEmptyString(stage.description) ? stage.description.trim() : "",
        jobIds: uniqueStrings(stage.jobIds).filter(function (jobId) { return jobIds.has(jobId); }),
        dependencies: uniqueStrings(stage.dependencies),
        skip: !!stage.skip,
      };
    });

  next.stages.forEach(function (stage) {
    stage.dependencies = stage.dependencies.filter(function (stageId) {
      return stageIds.has(stageId) && stageId !== stage.id;
    });
  });

  var pipelineIds = new Set();
  next.pipelines = next.pipelines
    .filter(function (pipeline) {
      return pipeline && typeof pipeline === "object" && !Array.isArray(pipeline);
    })
    .map(function (pipeline, index) {
      var id = isNonEmptyString(pipeline.id) ? pipeline.id : "pipeline-" + (index + 1);
      while (pipelineIds.has(id)) id += "-copy";
      pipelineIds.add(id);
      return {
        id: id,
        name: isNonEmptyString(pipeline.name) ? pipeline.name.trim() : "pipeline-" + (index + 1),
        description: isNonEmptyString(pipeline.description) ? pipeline.description.trim() : "",
        stageIds: uniqueStrings(pipeline.stageIds).filter(function (stageId) { return stageIds.has(stageId); }),
        triggers: normalizeTriggers(pipeline.triggers),
      };
    });

  var assignmentIds = new Set();
  next.assignments = next.assignments
    .filter(function (assignment) {
      return assignment && typeof assignment === "object" && !Array.isArray(assignment);
    })
    .map(function (assignment, index) {
      var id = isNonEmptyString(assignment.id) ? assignment.id : "assign-" + (index + 1);
      while (assignmentIds.has(id)) id += "-copy";
      assignmentIds.add(id);
      return {
        id: id,
        targetType: CICD_TARGET_TYPES.indexOf(assignment.targetType) >= 0 ? assignment.targetType : "branch",
        targetId: isNonEmptyString(assignment.targetId) ? assignment.targetId : "",
        pipelineIds: uniqueStrings(assignment.pipelineIds).filter(function (pipelineId) {
          return pipelineIds.has(pipelineId);
        }),
      };
    });

  return next;
}

export function normalizeTriggers(triggers) {
  if (!Array.isArray(triggers)) return [];
  return triggers
    .filter(function (trigger) {
      return trigger && typeof trigger === "object" && CICD_TRIGGER_TYPES.indexOf(trigger.type) >= 0;
    })
    .map(function (trigger) {
      var next = {
        type: trigger.type,
        enabled: !!trigger.enabled,
      };
      if (trigger.type === "scheduled") next.schedule = normalizeSchedule(trigger.schedule);
      return next;
    });
}

export function normalizeSchedule(schedule) {
  var source = schedule && typeof schedule === "object" && !Array.isArray(schedule) ? schedule : {};
  var mode = CICD_SCHEDULE_MODES.indexOf(source.mode) >= 0 ? source.mode : "daily";
  var next = { mode: mode };
  if (isNonEmptyString(source.time)) next.time = source.time.trim();
  if (isNonEmptyString(source.dayOfWeek)) next.dayOfWeek = source.dayOfWeek.trim();
  if (Number.isInteger(source.dayOfMonth)) next.dayOfMonth = source.dayOfMonth;
  if (isNonEmptyString(source.cron)) next.cron = source.cron.trim();
  return next;
}

export function hasStageDependencyCycle(stages, candidateId, nextDependencies) {
  var dependencyMap = new Map();
  stages.forEach(function (stage) {
    dependencyMap.set(stage.id, stage.id === candidateId ? nextDependencies.slice() : stage.dependencies.slice());
  });

  function visits(startId, targetId, seen) {
    if (startId === targetId) return true;
    if (seen.has(startId)) return false;
    seen.add(startId);
    var dependencies = dependencyMap.get(startId) || [];
    return dependencies.some(function (dependencyId) {
      return visits(dependencyId, targetId, seen);
    });
  }

  return nextDependencies.some(function (dependencyId) {
    return visits(dependencyId, candidateId, new Set());
  });
}

export function getMergeDotId(mergeRequest) {
  if (!mergeRequest) return "";
  return mergeRequest.mergeCommitId || mergeRequest.id;
}

export function getPipelineAssignmentForTarget(cicd, targetType, targetId) {
  if (!cicd || !Array.isArray(cicd.assignments)) return null;
  return cicd.assignments.find(function (assignment) {
    return assignment.targetType === targetType && assignment.targetId === targetId;
  }) || null;
}

export function getAssignmentsForTarget(cicd, targetType, targetId) {
  if (!cicd || !Array.isArray(cicd.assignments)) return [];
  return cicd.assignments.filter(function (assignment) {
    return assignment.targetType === targetType && assignment.targetId === targetId;
  });
}

export function getPipelineById(cicd, pipelineId) {
  if (!cicd || !Array.isArray(cicd.pipelines)) return null;
  return cicd.pipelines.find(function (pipeline) { return pipeline.id === pipelineId; }) || null;
}

export function getAssignedPipelines(cicd, targetType, targetId) {
  var assignment = getPipelineAssignmentForTarget(cicd, targetType, targetId);
  if (!assignment) return [];
  return assignment.pipelineIds
    .map(function (pipelineId) {
      return getPipelineById(cicd, pipelineId);
    })
    .filter(Boolean);
}

export function getPipelinesForTarget(cicd, targetType, targetId) {
  return getAssignmentsForTarget(cicd, targetType, targetId)
    .flatMap(function (assignment) { return assignment.pipelineIds; })
    .map(function (pipelineId) {
      return getPipelineById(cicd, pipelineId) || {
        id: pipelineId,
        name: "Missing pipeline reference",
        description: "",
        stageIds: [],
        triggers: [],
        missing: true,
      };
    });
}

export function getStageById(cicd, stageId) {
  if (!cicd || !Array.isArray(cicd.stages)) return null;
  return cicd.stages.find(function (stage) { return stage.id === stageId; }) || null;
}

export function getStagesForPipeline(cicd, pipeline) {
  if (!pipeline || !Array.isArray(pipeline.stageIds)) return [];
  return pipeline.stageIds.map(function (stageId) {
    return getStageById(cicd, stageId) || {
      id: stageId,
      name: "Missing stage reference",
      description: "",
      jobIds: [],
      dependencies: [],
      skip: false,
      missing: true,
    };
  });
}

export function getJobById(cicd, jobId) {
  if (!cicd || !Array.isArray(cicd.jobs)) return null;
  return cicd.jobs.find(function (job) { return job.id === jobId; }) || null;
}

export function getJobsForStage(cicd, stage) {
  if (!stage || !Array.isArray(stage.jobIds)) return [];
  return stage.jobIds.map(function (jobId) {
    return getJobById(cicd, jobId) || {
      id: jobId,
      name: "Missing job reference",
      description: "",
      missing: true,
    };
  });
}

export function getTriggerSummary(pipeline) {
  if (!pipeline || !Array.isArray(pipeline.triggers)) return ["No trigger rule enabled"];
  var enabledTriggers = pipeline.triggers
    .filter(function (trigger) { return trigger.enabled; })
    .map(formatTrigger)
    .filter(Boolean);
  return enabledTriggers.length ? enabledTriggers : ["No trigger rule enabled"];
}

export function getStageDependencyFlow(cicd, pipeline) {
  var stages = getStagesForPipeline(cicd, pipeline);
  if (!stages.length) return "No stages selected.";
  return stages.map(function (stage) { return stage.name; }).join(" -> ");
}

export function getCicdPresetConfig() {
  var jobs = [
    { id: "job-build", name: "build", description: "Compile project source code." },
    { id: "job-compliance-scan", name: "compliance-scan", description: "Run compliance and FOSS checks." },
    { id: "job-download-foss-scan-config", name: "download-FOSS-scan-config", description: "Fetch FOSS scan configuration." },
    { id: "job-helixqac", name: "helixqac", description: "Run Helix QAC static analysis." },
    { id: "job-polyspace", name: "polyspace", description: "Run Polyspace static analysis." },
    { id: "job-smoke-test", name: "smoke-test", description: "Run acceptance smoke tests." },
    { id: "job-memory-consumption", name: "memory_consumption", description: "Collect memory consumption data." },
    { id: "job-compiler-warnings", name: "compiler_warnings", description: "Collect compiler warning data." },
    { id: "job-helixqac-metrics", name: "helixqac_metrics", description: "Collect Helix QAC metrics." },
    { id: "job-mem-consumption-metrics", name: "mem_consumption_metrics", description: "Collect memory metrics." },
    { id: "job-polyspace-metrics", name: "polyspace_metrics", description: "Collect Polyspace metrics." },
    { id: "job-source-metrics", name: "source_metrics", description: "Collect source metrics." },
    { id: "job-send-mail", name: "send_mail", description: "Send configured pipeline summary email." },
  ];

  var stages = [
    { id: "stage-build", name: "build", description: "Build source code.", jobIds: ["job-build"], dependencies: [], skip: false },
    { id: "stage-foss", name: "foss", description: "Run FOSS and compliance checks.", jobIds: ["job-compliance-scan", "job-download-foss-scan-config"], dependencies: ["stage-build"], skip: false },
    { id: "stage-static-analysis", name: "static_analysis", description: "Run static analysis tools.", jobIds: ["job-helixqac", "job-polyspace"], dependencies: ["stage-foss"], skip: false },
    { id: "stage-acceptance-test", name: "acceptance_test", description: "Run acceptance validation.", jobIds: ["job-smoke-test"], dependencies: ["stage-static-analysis"], skip: false },
    { id: "stage-resources", name: "resources", description: "Collect resource data.", jobIds: ["job-memory-consumption", "job-compiler-warnings"], dependencies: ["stage-static-analysis"], skip: false },
    { id: "stage-metrics-collection", name: "metrics_collection", description: "Collect analysis and source metrics.", jobIds: ["job-helixqac-metrics", "job-mem-consumption-metrics", "job-polyspace-metrics", "job-source-metrics"], dependencies: ["stage-resources"], skip: false },
    { id: "stage-send-mail", name: "send_mail", description: "Send configured notifications.", jobIds: ["job-send-mail"], dependencies: ["stage-metrics-collection"], skip: false },
  ];

  var pipelines = [
    {
      id: "pipeline-basic-ci",
      name: "Basic CI",
      description: "A minimal CI configuration for merge request validation.",
      stageIds: ["stage-build"],
      triggers: [{ type: "on_merge_request", enabled: true }],
    },
    {
      id: "pipeline-mr-validation",
      name: "MR Validation",
      description: "Validation pipeline configured for merge requests.",
      stageIds: ["stage-build", "stage-foss", "stage-static-analysis", "stage-acceptance-test"],
      triggers: [{ type: "on_merge_request", enabled: true }],
    },
    {
      id: "pipeline-nightly-validation",
      name: "Nightly Validation",
      description: "Full nightly validation pipeline.",
      stageIds: ["stage-build", "stage-foss", "stage-static-analysis", "stage-resources", "stage-metrics-collection", "stage-send-mail"],
      triggers: [{ type: "scheduled", enabled: true, schedule: { mode: "daily", time: "19:00" } }],
    },
  ];

  return normalizeCicdConfig({
    jobs: jobs,
    stages: stages,
    pipelines: pipelines,
    assignments: [],
  });
}

export function formatTrigger(trigger) {
  if (!trigger || !trigger.enabled) return "";
  if (trigger.type === "on_merge_request") return "On Merge Request";
  if (trigger.type === "scheduled") {
    var schedule = trigger.schedule || {};
    if (schedule.mode === "daily") return "Scheduled: Daily" + (schedule.time ? " at " + schedule.time : "");
    if (schedule.mode === "weekly") return "Scheduled: Weekly" + (schedule.dayOfWeek ? " on " + schedule.dayOfWeek : "") + (schedule.time ? " at " + schedule.time : "");
    if (schedule.mode === "monthly") return "Scheduled: Monthly" + (schedule.dayOfMonth ? " on day " + schedule.dayOfMonth : "") + (schedule.time ? " at " + schedule.time : "");
    if (schedule.mode === "custom_cron") return "Scheduled: " + (schedule.cron || "Custom cron");
    return "Scheduled";
  }
  return trigger.type;
}

export function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  var seen = new Set();
  return values.filter(function (value) {
    if (!isNonEmptyString(value) || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
