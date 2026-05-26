export function truncate(text, size) {
  if (!text) return "";
  return text.length > size ? text.slice(0, size - 1) + "..." : text;
}

export function formatTime(value) {
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function setFeedback(element, message, tone) {
  element.textContent = message || "";
  element.classList.remove("is-error", "is-success");
  if (tone) element.classList.add("is-" + tone);
}

export function createOption(value, text, selected) {
  var option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  option.selected = !!selected;
  return option;
}

export function replaceOptions(select, options, selectedValue) {
  select.replaceChildren();
  options.forEach(function (option) {
    select.appendChild(createOption(option.value, option.text, option.value === selectedValue));
  });
}

export function createChip(text, color, className) {
  var chip = document.createElement("span");
  chip.className = className;
  var dot = document.createElement("span");
  dot.className = "branch-dot";
  dot.style.backgroundColor = color;
  chip.append(dot, document.createTextNode(text));
  return chip;
}

export function createTextChip(text, className) {
  var chip = document.createElement("span");
  chip.className = className;
  chip.textContent = text;
  return chip;
}

export function svgEl(name, attrs) {
  var element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.keys(attrs || {}).forEach(function (key) {
    element.setAttribute(key, attrs[key]);
  });
  return element;
}
