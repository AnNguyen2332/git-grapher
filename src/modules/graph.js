import { GRAPH_LAYOUT } from "./config.js";
import { svgEl, truncate } from "./ui.js";

export function renderGraph(context) {
  var state = context.state;
  var els = context.els;
  var getBranch = context.getBranch;
  var getCommit = context.getCommit;
  var svg = els.gitGraph;
  svg.replaceChildren();

  var orientation = getOrientation(state);
  if (els.graphPanel) els.graphPanel.dataset.orientation = orientation;

  var orderedCommits = state.commits.slice().sort(function (a, b) {
    return a.seq - b.seq;
  });
  var laneCount = Math.max.apply(null, state.branches.map(function (branch) { return branch.lane; })) + 1;
  var commitGap = GRAPH_LAYOUT.commitGap;
  var laneGap = GRAPH_LAYOUT.laneGap;
  var margin = GRAPH_LAYOUT.margin;
  var isVertical = orientation === "vertical";
  var viewport = getGraphViewport(els);
  var width = isVertical
    ? Math.max(760, viewport.width, margin.left + margin.right + Math.max(0, laneCount - 1) * laneGap)
    : Math.max(980, viewport.width, margin.left + margin.right + Math.max(0, orderedCommits.length - 1) * commitGap);
  var height = isVertical
    ? Math.max(620, viewport.height, margin.top + margin.bottom + Math.max(0, orderedCommits.length - 1) * commitGap)
    : Math.max(420, viewport.height, margin.top + margin.bottom + Math.max(0, laneCount - 1) * laneGap);
  var positions = new Map();

  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  orderedCommits.forEach(function (commit, index) {
    var branch = getBranch(commit.branchId) || getBranch("root");
    positions.set(commit.id, {
      x: isVertical ? margin.left + branch.lane * laneGap : margin.left + index * commitGap,
      y: isVertical ? margin.top + index * commitGap : margin.top + branch.lane * laneGap,
      branch: branch,
    });
  });

  renderBranchAxis({ state: state, els: els, width: width, height: height, orientation: orientation });
  renderLaneLines({ state: state, svg: svg, positions: positions, margin: margin, width: width, height: height, orientation: orientation });
  renderEdges({ state: state, svg: svg, orderedCommits: orderedCommits, positions: positions, getBranch: getBranch, getCommit: getCommit, orientation: orientation });
  renderNodes({ state: state, svg: svg, orderedCommits: orderedCommits, positions: positions });
  renderTagLabels({ state: state, svg: svg, positions: positions, graphWidth: width, orientation: orientation });
  syncBranchAxisScroll(els);
}

export function syncBranchAxisScroll(els) {
  if (!els.graphScroll || !els.branchAxis) return;
  if (els.graphPanel && els.graphPanel.dataset.orientation === "vertical") {
    els.branchAxis.scrollLeft = els.graphScroll.scrollLeft;
    return;
  }
  els.branchAxis.scrollTop = els.graphScroll.scrollTop;
}

function getOrientation(state) {
  return state.settings && state.settings.graphOrientation === "vertical" ? "vertical" : "horizontal";
}

function getGraphViewport(els) {
  if (!els.graphScroll) return { width: 0, height: 0 };
  return {
    width: els.graphScroll.clientWidth || 0,
    height: els.graphScroll.clientHeight || 0,
  };
}

function renderBranchAxis(context) {
  var state = context.state;
  var els = context.els;
  var width = context.width;
  var height = context.height;
  var orientation = context.orientation;
  els.branchAxis.replaceChildren();
  els.branchAxis.dataset.orientation = orientation;

  var inner = document.createElement("div");
  inner.className = "branch-axis-inner";
  inner.style.height = orientation === "vertical" ? GRAPH_LAYOUT.branchAxisWidth + "px" : height + "px";
  inner.style.width = orientation === "vertical" ? width + "px" : "100%";

  state.branches.forEach(function (branch) {
    var label = document.createElement("div");
    label.className = "branch-axis-label";
    if (orientation === "vertical") {
      label.style.left = (GRAPH_LAYOUT.margin.left + branch.lane * GRAPH_LAYOUT.laneGap - 48) + "px";
      label.style.top = "28px";
      label.style.width = "96px";
    } else {
      label.style.top = (GRAPH_LAYOUT.margin.top + branch.lane * GRAPH_LAYOUT.laneGap - 15) + "px";
    }

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
  var height = context.height;
  var orientation = context.orientation;

  state.branches.forEach(function (branch) {
    var start = positions.get(branch.startCommitId) || positions.get(branch.headCommitId);
    var head = positions.get(branch.headCommitId);
    var x = margin.left + branch.lane * GRAPH_LAYOUT.laneGap;
    var y = margin.top + branch.lane * GRAPH_LAYOUT.laneGap;

    if (orientation === "vertical") {
      var y1 = start ? start.y : margin.top;
      var y2 = head ? Math.max(head.y, y1 + 38) : height - margin.bottom;
      svg.appendChild(svgEl("line", {
        class: "svg-lane",
        x1: String(x),
        y1: String(y1),
        x2: String(x),
        y2: String(y2),
      }));
      return;
    }

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
  var orientation = context.orientation;

  orderedCommits.forEach(function (commit) {
    var child = positions.get(commit.id);
    if (!child) return;

    commit.parents.forEach(function (parentId, parentIndex) {
      var parent = positions.get(parentId);
      var parentCommit = getCommit(parentId);
      if (!parent || !parentCommit) return;

      var colorBranch = parentIndex === 0 ? child.branch : getBranch(parentCommit.branchId) || parent.branch;
      var dx = Math.max(60, Math.abs(child.x - parent.x) * 0.45);
      var dy = Math.max(60, Math.abs(child.y - parent.y) * 0.45);
      var isBranchStartEdge = parentIndex === 0 && parentCommit.branchId !== commit.branchId;
      var path = isBranchStartEdge
        ? branchStartPath(parent, child, orientation)
        : orientation === "vertical"
        ? "M " + parent.x + " " + parent.y +
          " C " + parent.x + " " + (parent.y + dy) +
          ", " + child.x + " " + (child.y - dy) +
          ", " + child.x + " " + child.y
        : "M " + parent.x + " " + parent.y +
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

function branchStartPath(parent, child, orientation) {
  if (orientation === "vertical") {
    var spanY = child.y - parent.y;
    var directionY = spanY >= 0 ? 1 : -1;
    var bendY = Math.min(
      Math.abs(spanY) - 40,
      Math.max(96, Math.min(300, Math.abs(child.x - parent.x) * 0.62 + 96))
    );
    if (bendY <= 0) bendY = Math.abs(spanY) / 2;
    var turnY = parent.y + directionY * bendY;
    var controlY = Math.max(64, Math.min(150, bendY * 0.58));

    return "M " + parent.x + " " + parent.y +
      " C " + parent.x + " " + (parent.y + directionY * controlY) +
      ", " + child.x + " " + (turnY - directionY * controlY) +
      ", " + child.x + " " + turnY +
      " L " + child.x + " " + child.y;
  }

  var spanX = child.x - parent.x;
  var directionX = spanX >= 0 ? 1 : -1;
  var curveRunX = Math.min(
    Math.abs(spanX) - 40,
    Math.max(96, Math.min(300, Math.abs(child.y - parent.y) * 0.62 + 96))
  );
  if (curveRunX <= 0) curveRunX = Math.abs(spanX) / 2;
  var turnX = parent.x + directionX * curveRunX;
  var controlX = Math.max(64, Math.min(150, curveRunX * 0.58));

  return "M " + parent.x + " " + parent.y +
    " C " + (parent.x + directionX * controlX) + " " + parent.y +
    ", " + (turnX - directionX * controlX) + " " + child.y +
    ", " + turnX + " " + child.y +
    " L " + child.x + " " + child.y;
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

    if (commit.id === state.selectedCommitId) {
      group.appendChild(svgEl("circle", {
        class: "svg-selected-ring",
        cx: String(pos.x),
        cy: String(pos.y),
        r: "19",
      }));
    }

    var circleClass = "svg-node";
    group.appendChild(svgEl("circle", {
      class: circleClass,
      cx: String(pos.x),
      cy: String(pos.y),
      r: "10",
      fill: "#ffffff",
      stroke: pos.branch.color,
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
  var orientation = context.orientation;
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

    if (orientation === "vertical") {
      x = pos.x + 24 + offset;
      if (x + width > graphWidth - 12) x = Math.max(12, pos.x - width - 24 - offset);
      y = Math.max(28, pos.y - 12);
      belowNode = x < pos.x;
    }

    var rectY = y - 17;
    var group = svgEl("g", {
      class: "svg-tag",
      role: "button",
      tabindex: "0",
      "data-tag-id": tag.id,
      "aria-label": "Edit tag " + tag.name,
    });

    group.appendChild(svgEl("line", {
      class: "svg-tag-line",
      x1: String(pos.x + (orientation === "vertical" ? (belowNode ? -8 : 8) : 8)),
      y1: String(pos.y + (orientation === "vertical" ? 0 : (belowNode ? 9 : -9))),
      x2: String(x),
      y2: String(rectY + 11.5),
    }));

    group.appendChild(svgEl("rect", {
      class: "svg-tag-box",
      x: String(x),
      y: String(rectY),
      width: String(width),
      height: "23",
      rx: "7",
      fill: "#ffffff",
      stroke: "#fb923c",
      "stroke-width": "1.5",
    }));

    var text = svgEl("text", {
      class: "svg-tag-label",
      x: String(x + width / 2),
      y: String(rectY + 11.5),
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    });
    text.textContent = label;
    group.appendChild(text);
    svg.appendChild(group);
  });
}
