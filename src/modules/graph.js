import { GRAPH_LAYOUT } from "./config.js";
import { svgEl, truncate } from "./ui.js";

export function renderGraph(context) {
  var state = context.state;
  var els = context.els;
  var getBranch = context.getBranch;
  var getCommit = context.getCommit;
  var svg = els.gitGraph;
  svg.replaceChildren();

  var orderedCommits = state.commits.slice().sort(function (a, b) {
    return a.seq - b.seq;
  });
  var laneCount = Math.max.apply(null, state.branches.map(function (branch) { return branch.lane; })) + 1;
  var commitGap = GRAPH_LAYOUT.commitGap;
  var laneGap = GRAPH_LAYOUT.laneGap;
  var margin = GRAPH_LAYOUT.margin;
  var width = Math.max(980, margin.left + margin.right + Math.max(0, orderedCommits.length - 1) * commitGap);
  var height = Math.max(420, margin.top + margin.bottom + Math.max(0, laneCount - 1) * laneGap);
  var positions = new Map();

  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  orderedCommits.forEach(function (commit, index) {
    var branch = getBranch(commit.branchId) || getBranch("root");
    positions.set(commit.id, {
      x: margin.left + index * commitGap,
      y: margin.top + branch.lane * laneGap,
      branch: branch,
    });
  });

  renderBranchAxis({ state: state, els: els, height: height });
  renderLaneLines({ state: state, svg: svg, positions: positions, margin: margin, width: width });
  renderEdges({ state: state, svg: svg, orderedCommits: orderedCommits, positions: positions, getBranch: getBranch, getCommit: getCommit });
  renderNodes({ state: state, svg: svg, orderedCommits: orderedCommits, positions: positions });
  renderTagLabels({ state: state, svg: svg, positions: positions, graphWidth: width });
  syncBranchAxisScroll(els);
}

export function syncBranchAxisScroll(els) {
  if (!els.graphScroll || !els.branchAxis) return;
  els.branchAxis.scrollTop = els.graphScroll.scrollTop;
}

function renderBranchAxis(context) {
  var state = context.state;
  var els = context.els;
  var height = context.height;
  els.branchAxis.replaceChildren();

  var inner = document.createElement("div");
  inner.className = "branch-axis-inner";
  inner.style.height = height + "px";

  state.branches.forEach(function (branch) {
    var label = document.createElement("div");
    label.className = "branch-axis-label";
    label.style.top = (GRAPH_LAYOUT.margin.top + branch.lane * GRAPH_LAYOUT.laneGap - 15) + "px";

    var dot = document.createElement("span");
    dot.className = "branch-dot";
    dot.style.backgroundColor = branch.color;

    var text = document.createElement("span");
    text.textContent = branch.name;

    label.append(dot, text);
    inner.appendChild(label);
  });

  els.branchAxis.appendChild(inner);
}

function renderLaneLines(context) {
  var state = context.state;
  var svg = context.svg;
  var positions = context.positions;
  var margin = context.margin;
  var width = context.width;

  state.branches.forEach(function (branch) {
    var start = positions.get(branch.startCommitId) || positions.get(branch.headCommitId);
    var head = positions.get(branch.headCommitId);
    var y = margin.top + branch.lane * GRAPH_LAYOUT.laneGap;
    var x1 = start ? start.x : margin.left;
    var x2 = head ? Math.max(head.x, x1 + 38) : width - margin.right;

    svg.appendChild(svgEl("line", {
      class: "svg-lane",
      x1: String(x1),
      y1: String(y),
      x2: String(x2),
      y2: String(y),
    }));
  });
}

function renderEdges(context) {
  var svg = context.svg;
  var orderedCommits = context.orderedCommits;
  var positions = context.positions;
  var getBranch = context.getBranch;
  var getCommit = context.getCommit;

  orderedCommits.forEach(function (commit) {
    var child = positions.get(commit.id);
    if (!child) return;

    commit.parents.forEach(function (parentId, parentIndex) {
      var parent = positions.get(parentId);
      var parentCommit = getCommit(parentId);
      if (!parent || !parentCommit) return;

      var colorBranch = parentIndex === 0 ? child.branch : getBranch(parentCommit.branchId) || parent.branch;
      var dx = Math.max(60, Math.abs(child.x - parent.x) * 0.45);
      var path = "M " + parent.x + " " + parent.y +
        " C " + (parent.x + dx) + " " + parent.y +
        ", " + (child.x - dx) + " " + child.y +
        ", " + child.x + " " + child.y;

      svg.appendChild(svgEl("path", {
        class: parentIndex > 0 ? "svg-edge merge-edge" : "svg-edge",
        d: path,
        stroke: colorBranch.color,
        opacity: parentIndex > 0 ? "0.78" : "0.88",
      }));
    });
  });
}

function renderNodes(context) {
  var state = context.state;
  var svg = context.svg;
  var orderedCommits = context.orderedCommits;
  var positions = context.positions;

  orderedCommits.forEach(function (commit) {
    var pos = positions.get(commit.id);
    if (!pos) return;

    var group = svgEl("g", {
      role: "button",
      tabindex: "0",
      "data-commit-id": commit.id,
      "aria-label": commit.id + " " + commit.message,
    });

    var circleClass = commit.id === state.selectedCommitId ? "svg-node is-selected" : "svg-node";
    group.appendChild(svgEl("circle", {
      class: circleClass,
      cx: String(pos.x),
      cy: String(pos.y),
      r: "12",
      fill: pos.branch.color,
    }));

    var idText = svgEl("text", {
      class: "svg-commit-id",
      x: String(pos.x),
      y: String(pos.y - 24),
      "text-anchor": "middle",
    });
    idText.textContent = commit.id;
    group.appendChild(idText);

    var message = svgEl("text", {
      class: "svg-message",
      x: String(pos.x),
      y: String(pos.y + 36),
      "text-anchor": "middle",
    });
    message.textContent = truncate(commit.message, 24);
    group.appendChild(message);

    svg.appendChild(group);
  });
}

function renderTagLabels(context) {
  var state = context.state;
  var svg = context.svg;
  var positions = context.positions;
  var graphWidth = context.graphWidth;
  var tagCounts = {};

  state.tags.forEach(function (tag) {
    var pos = positions.get(tag.commitId);
    if (!pos) return;

    tagCounts[tag.commitId] = tagCounts[tag.commitId] || 0;
    var offset = tagCounts[tag.commitId] * 25;
    tagCounts[tag.commitId] += 1;

    var label = tag.name;
    var width = Math.max(52, label.length * 7 + 26);
    var x = Math.min(pos.x + 20, graphWidth - width - 18);
    var y = pos.y - 42 - offset;
    var belowNode = false;
    if (y - 19 < 8) {
      y = pos.y + 70 + offset;
      belowNode = true;
    }

    svg.appendChild(svgEl("line", {
      class: "svg-tag-line",
      x1: String(pos.x + 8),
      y1: String(pos.y + (belowNode ? 9 : -9)),
      x2: String(x),
      y2: String(y - 6),
    }));

    svg.appendChild(svgEl("rect", {
      x: String(x),
      y: String(y - 17),
      width: String(width),
      height: "23",
      rx: "6",
      fill: "#fff7ed",
      stroke: "#f97316",
      "stroke-width": "1.5",
    }));

    var text = svgEl("text", {
      class: "svg-tag-label",
      x: String(x + 10),
      y: String(y),
    });
    text.textContent = label;
    svg.appendChild(text);
  });
}
