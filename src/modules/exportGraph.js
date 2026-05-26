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
  var source = els.gitGraph.cloneNode(true);
  var viewBox = (source.getAttribute("viewBox") || "0 0 980 420")
    .split(/\s+/)
    .map(Number);
  var graphWidth = viewBox[2] || Number(source.getAttribute("width")) || 980;
  var graphHeight = viewBox[3] || Number(source.getAttribute("height")) || 420;
  var axisWidth = GRAPH_LAYOUT.branchAxisWidth;
  var exportWidth = graphWidth + axisWidth;

  var output = svgEl("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: String(exportWidth),
    height: String(graphHeight),
    viewBox: "0 0 " + exportWidth + " " + graphHeight,
  });

  var style = svgEl("style");
  style.textContent = [
    ".svg-lane{stroke:#e5e7eb;stroke-width:2;stroke-dasharray:5 8}",
    ".svg-edge{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:6}",
    ".svg-edge.merge-edge{stroke-dasharray:8 8}",
    ".svg-node{stroke:#ffffff;stroke-width:3}",
    ".svg-node.is-selected{stroke:#f97316;stroke-width:7}",
    ".svg-message,.svg-branch-label,.svg-tag-label,.svg-commit-id{font-family:Consolas,'Liberation Mono',monospace}",
    ".svg-message{fill:#27272a;font-size:12px}",
    ".svg-commit-id{fill:#71717a;font-size:11px}",
    ".svg-branch-label{fill:#18181b;font-size:12px;font-weight:700}",
    ".svg-tag-label{fill:#9a3412;font-size:11px;font-weight:700}",
    ".svg-tag-line{stroke:#f97316;stroke-width:1.5;stroke-dasharray:3 4}",
  ].join("\n");
  output.appendChild(style);

  output.appendChild(svgEl("rect", {
    x: "0",
    y: "0",
    width: String(exportWidth),
    height: String(graphHeight),
    fill: "#ffffff",
  }));

  appendExportBranchAxis({ state: state, svg: output, height: graphHeight, getBranch: getBranch });
  source.setAttribute("x", String(axisWidth));
  source.setAttribute("y", "0");
  source.setAttribute("width", String(graphWidth));
  source.setAttribute("height", String(graphHeight));
  source.setAttribute("viewBox", "0 0 " + graphWidth + " " + graphHeight);
  output.appendChild(source);

  return {
    svg: output,
    width: exportWidth,
    height: graphHeight,
  };
}

function appendExportBranchAxis(context) {
  var state = context.state;
  var svg = context.svg;
  var height = context.height;
  var axisWidth = GRAPH_LAYOUT.branchAxisWidth;

  svg.appendChild(svgEl("rect", {
    x: "0",
    y: "0",
    width: String(axisWidth),
    height: String(height),
    fill: "#fafafa",
    stroke: "#e5e7eb",
    "stroke-width": "1",
  }));

  state.branches.forEach(function (branch) {
    var y = GRAPH_LAYOUT.margin.top + branch.lane * GRAPH_LAYOUT.laneGap;
    svg.appendChild(svgEl("circle", {
      cx: "22",
      cy: String(y),
      r: "5",
      fill: branch.color,
    }));

    var text = svgEl("text", {
      class: "svg-branch-label",
      x: "36",
      y: String(y + 4),
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
