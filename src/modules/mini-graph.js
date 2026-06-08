var SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  var node = document.createElementNS(SVG_NS, tag);
  for (var k in attrs) {
    if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
  }
  return node;
}

function computeLayout(state, cGap, lGap, marg) {
  var commits = state.commits.slice().sort(function (a, b) { return a.seq - b.seq; });
  var pos = new Map();
  commits.forEach(function (c, i) {
    var br = state.branches.find(function (b) { return b.id === c.branchId; }) || state.branches[0];
    pos.set(c.id, { x: marg + i * cGap, y: marg + br.lane * lGap, branch: br });
  });
  return { commits: commits, pos: pos };
}

function branchStartPath(parent, child) {
  var spanX = child.x - parent.x;
  var dirX = spanX >= 0 ? 1 : -1;
  var run = Math.min(
    Math.abs(spanX) - 40,
    Math.max(96, Math.min(300, Math.abs(child.y - parent.y) * 0.62 + 96))
  );
  if (run <= 0) run = Math.abs(spanX) / 2;
  var turnX = parent.x + dirX * run;
  var cx = Math.max(64, Math.min(150, run * 0.58));
  return (
    "M " + parent.x + " " + parent.y +
    " C " + (parent.x + dirX * cx) + " " + parent.y +
    ", " + (turnX - dirX * cx) + " " + child.y +
    ", " + turnX + " " + child.y +
    " L " + child.x + " " + child.y
  );
}

export function renderMiniGraph(container, state, isHero) {
  // Scale constants — hero uses full layout, cards use 40% scale
  var cGap = isHero ? 155 : 62;
  var lGap = isHero ? 86 : 34;
  var marg = isHero ? 88 : 24;
  var nodeR = isHero ? 10 : 10;
  var strokeW = isHero ? 2 : 2;

  var layout = computeLayout(state, cGap, lGap, marg);
  var commits = layout.commits;
  var pos = layout.pos;
  var allPos = Array.from(pos.values());

  var xs = allPos.map(function (p) { return p.x; });
  var ys = allPos.map(function (p) { return p.y; });
  var minX = Math.min.apply(null, xs);
  var maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys);
  var maxY = Math.max.apply(null, ys);

  var padX = isHero ? 22 : 16;
  var padY = isHero ? 28 : 16;
  var rightExtra = isHero ? 180 : padX; // branch label space for hero
  // Extend viewBox leftward for hero: reduces scale factor and pushes graph data
  // into the right 80%+ of the hero where the gradient fade is transparent.
  var leftExt = isHero ? 1000 : 0;
  var vbX = minX - padX - leftExt;
  var vbY = minY - padY;
  var vbW = (maxX - minX) + padX + rightExtra + leftExt;
  var vbH = (maxY - minY) + padY * 2;

  var svg = el("svg", {
    viewBox: [vbX, vbY, vbW, vbH].join(" "),
    preserveAspectRatio: isHero ? "xMaxYMid meet" : "xMinYMid meet",
    "aria-hidden": "true",
  });
  svg.style.cssText = "width:100%;height:100%;display:block;";

  // Lane lines
  state.branches.forEach(function (branch) {
    var sp = pos.get(branch.startCommitId) || pos.get(branch.headCommitId);
    var hp = pos.get(branch.headCommitId);
    if (!sp || !hp) return;
    var y = marg + branch.lane * lGap;
    svg.appendChild(el("line", {
      x1: String(sp.x), y1: String(y),
      x2: String(hp.x), y2: String(y),
      stroke: branch.color, "stroke-width": String(strokeW),
      opacity: "0.5",
    }));
  });

  // Edges
  commits.forEach(function (commit) {
    var child = pos.get(commit.id);
    (commit.parents || []).forEach(function (parentId, pIdx) {
      var parent = pos.get(parentId);
      var parentCommit = state.commits.find(function (c) { return c.id === parentId; });
      if (!parent || !parentCommit) return;

      var colorBr = pIdx === 0
        ? child.branch
        : (state.branches.find(function (b) { return b.id === parentCommit.branchId; }) || parent.branch);

      var isBranchStart = pIdx === 0 && parentCommit.branchId !== commit.branchId;
      var dx = Math.max(isHero ? 60 : 24, Math.abs(child.x - parent.x) * 0.45);
      var d = isBranchStart
        ? branchStartPath(parent, child)
        : "M " + parent.x + " " + parent.y +
          " C " + (parent.x + dx) + " " + parent.y +
          ", " + (child.x - dx) + " " + child.y +
          ", " + child.x + " " + child.y;

      svg.appendChild(el("path", {
        d: d, fill: "none",
        stroke: colorBr.color,
        "stroke-width": pIdx > 0 ? String(strokeW * 0.75) : String(strokeW),
        opacity: pIdx > 0 ? "0.75" : "0.88",
      }));
    });
  });

  // Tag rings
  (state.tags || []).forEach(function (tag) {
    var p = pos.get(tag.commitId);
    if (!p) return;
    svg.appendChild(el("circle", {
      cx: String(p.x), cy: String(p.y), r: String(nodeR + 6),
      fill: "none", stroke: "#B46200", "stroke-width": "2",
      "stroke-dasharray": isHero ? "4 3" : "3 2", opacity: "0.8",
    }));
  });

  // Commit nodes
  commits.forEach(function (commit) {
    var p = pos.get(commit.id);
    svg.appendChild(el("circle", {
      cx: String(p.x), cy: String(p.y), r: String(nodeR),
      fill: "#ffffff", stroke: p.branch.color, "stroke-width": "3",
    }));
  });

  // Branch labels (hero only)
  if (isHero) {
    state.branches.forEach(function (branch) {
      var hp = pos.get(branch.headCommitId);
      if (!hp) return;
      var y = marg + branch.lane * lGap;
      var lbl = el("text", {
        x: String(hp.x + 18), y: String(y + 5),
        fill: branch.color, "font-size": "13", "font-weight": "600",
        "font-family": "'Inter',system-ui,sans-serif",
        opacity: "0.85",
      });
      lbl.textContent = branch.name;
      svg.appendChild(lbl);
    });

    (state.tags || []).forEach(function (tag) {
      var p = pos.get(tag.commitId);
      if (!p) return;
      var lbl = el("text", {
        x: String(p.x), y: String(p.y + 32),
        "text-anchor": "middle",
        fill: "#B46200", "font-size": "11", "font-weight": "600",
        "font-family": "'Inter',system-ui,sans-serif",
        opacity: "0.85",
      });
      lbl.textContent = tag.name;
      svg.appendChild(lbl);
    });
  }

  container.innerHTML = "";
  container.appendChild(svg);
  container.classList.add("has-svg");
}
