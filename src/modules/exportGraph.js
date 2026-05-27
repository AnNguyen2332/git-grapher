import { EXPORT_FILENAME, GRAPH_LAYOUT } from "./config.js";
import { svgEl } from "./ui.js";

export function exportGraphPng(context) {
  var els = context.els;
  var exportData = buildExportSvg(context);
  var serialized = new XMLSerializer().serializeToString(exportData.svg);
  var svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  var svgUrl = URL.createObjectURL(svgBlob);
  var image = new Image();

  els.exportGraphButton.disabled = true;
  els.exportGraphButton.textContent = "Exporting...";

  image.onload = function () {
    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = exportData.width * scale;
    canvas.height = exportData.height * scale;
    var context2d = canvas.getContext("2d");
    context2d.fillStyle = "#ffffff";
    context2d.fillRect(0, 0, canvas.width, canvas.height);
    context2d.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(svgUrl);

    canvas.toBlob(function (blob) {
      if (blob) downloadBlob(blob, EXPORT_FILENAME);
      els.exportGraphButton.disabled = false;
      els.exportGraphButton.textContent = "Export PNG";
    }, "image/png");
  };

  image.onerror = function () {
    URL.revokeObjectURL(svgUrl);
    els.exportGraphButton.disabled = false;
    els.exportGraphButton.textContent = "Export PNG";
  };

  image.src = svgUrl;
}

function buildExportSvg(context) {
  var state = context.state;
  var els = context.els;
  var getBranch = context.getBranch;
  var orientation = state.settings && state.settings.graphOrientation === "vertical" ? "vertical" : "horizontal";
  var source = els.gitGraph.cloneNode(true);
  var viewBox = (source.getAttribute("viewBox") || "0 0 980 420")
    .split(/\s+/)
    .map(Number);
  var graphWidth = viewBox[2] || Number(source.getAttribute("width")) || 980;
  var graphHeight = viewBox[3] || Number(source.getAttribute("height")) || 420;
  var axisWidth = GRAPH_LAYOUT.branchAxisWidth;
  var exportWidth = orientation === "vertical" ? graphWidth : graphWidth + axisWidth;
  var exportHeight = orientation === "vertical" ? graphHeight + axisWidth : graphHeight;

  var output = svgEl("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: String(exportWidth),
    height: String(exportHeight),
    viewBox: "0 0 " + exportWidth + " " + exportHeight,
  });

  var style = svgEl("style");
  style.textContent = [
    ".svg-lane{stroke:#dbe4ef;stroke-width:2;stroke-dasharray:7 9}",
    ".svg-edge{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:6}",
    ".svg-edge.merge-edge{stroke-dasharray:10 8}",
    ".svg-selected-ring{fill:none;opacity:.32;stroke:#f97316;stroke-width:4}",
    ".svg-node{stroke-width:6}",
    ".svg-message,.svg-branch-label,.svg-tag-label,.svg-commit-id{font-family:Inter,Arial,sans-serif}",
    ".svg-message{fill:#64748b;font-size:11px}",
    ".svg-commit-id{fill:#64748b;font-size:10px;font-weight:800}",
    ".svg-branch-label{fill:#020617;font-size:12px;font-weight:800}",
    ".svg-tag-label{fill:#c2410c;font-size:10px;font-weight:800;text-anchor:middle;dominant-baseline:middle}",
    ".svg-tag-line{stroke:#f97316;stroke-width:1.5;stroke-dasharray:3 4}",
  ].join("\n");
  output.appendChild(style);

  output.appendChild(svgEl("rect", {
    x: "0",
    y: "0",
    width: String(exportWidth),
    height: String(exportHeight),
    fill: "#ffffff",
  }));

  appendExportBranchAxis({
    state: state,
    svg: output,
    width: graphWidth,
    height: graphHeight,
    orientation: orientation,
    getBranch: getBranch,
  });
  source.setAttribute("x", orientation === "vertical" ? "0" : String(axisWidth));
  source.setAttribute("y", orientation === "vertical" ? String(axisWidth) : "0");
  source.setAttribute("width", String(graphWidth));
  source.setAttribute("height", String(graphHeight));
  source.setAttribute("viewBox", "0 0 " + graphWidth + " " + graphHeight);
  output.appendChild(source);

  return {
    svg: output,
    width: exportWidth,
    height: exportHeight,
  };
}

function appendExportBranchAxis(context) {
  var state = context.state;
  var svg = context.svg;
  var width = context.width;
  var height = context.height;
  var orientation = context.orientation;
  var axisWidth = GRAPH_LAYOUT.branchAxisWidth;

  svg.appendChild(svgEl("rect", {
    x: "0",
    y: "0",
    width: String(orientation === "vertical" ? width : axisWidth),
    height: String(orientation === "vertical" ? axisWidth : height),
    fill: "#f8fafc",
    stroke: "#e2e8f0",
    "stroke-width": "1",
  }));

  state.branches.forEach(function (branch) {
    var x = orientation === "vertical" ? GRAPH_LAYOUT.margin.left + branch.lane * GRAPH_LAYOUT.laneGap : 22;
    var y = orientation === "vertical" ? 58 : GRAPH_LAYOUT.margin.top + branch.lane * GRAPH_LAYOUT.laneGap;
    svg.appendChild(svgEl("circle", {
      cx: String(x),
      cy: String(y),
      r: "5",
      fill: branch.color,
    }));

    var text = svgEl("text", {
      class: "svg-branch-label",
      x: String(orientation === "vertical" ? x : 36),
      y: String(orientation === "vertical" ? y + 22 : y + 4),
      "text-anchor": orientation === "vertical" ? "middle" : "start",
    });
    text.textContent = branch.name;
    svg.appendChild(text);
  });
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
