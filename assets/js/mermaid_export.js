/* CaaT Academy Mermaid exporter
 *
 * Adds SVG and 4x PNG download controls to every rendered Mermaid diagram.
 * The exported SVG is made PowerPoint-friendly by:
 *   1. inlining computed colours, strokes, and fonts as SVG attributes;
 *   2. replacing HTML foreignObject labels with native SVG text;
 *   3. inserting an explicit diagram background rectangle.
 */
(function () {
  "use strict";

  var MERMAID_SELECTOR = ".mermaid";
  var PNG_SCALE = 4;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var XLINK_NS = "http://www.w3.org/1999/xlink";
  var scanTimer = null;
  var diagramCounter = 0;

  var PRESENTATION_PROPERTIES = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-opacity",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "font-variant",
    "letter-spacing",
    "word-spacing",
    "text-anchor",
    "dominant-baseline",
    "paint-order",
    "stop-color",
    "stop-opacity",
    "marker-start",
    "marker-mid",
    "marker-end"
  ];

  function normalisePaintServer(value) {
    if (!value || value === "none") {
      return value;
    }

    return value.replace(
      /url\(["']?(?:[^"')]*#)([^"')]+)["']?\)/g,
      "url(#$1)"
    );
  }

  function meaningfulStyleValue(value) {
    return Boolean(value && value.trim() && value.trim() !== "auto");
  }

  function inlineComputedStyles(sourceSvg, clonedSvg) {
    var sourceElements = [sourceSvg].concat(
      Array.prototype.slice.call(sourceSvg.querySelectorAll("*"))
    );
    var clonedElements = [clonedSvg].concat(
      Array.prototype.slice.call(clonedSvg.querySelectorAll("*"))
    );
    var count = Math.min(sourceElements.length, clonedElements.length);

    for (var index = 0; index < count; index += 1) {
      var source = sourceElements[index];
      var clone = clonedElements[index];
      var computed;

      try {
        computed = window.getComputedStyle(source);
      } catch (error) {
        continue;
      }

      PRESENTATION_PROPERTIES.forEach(function (property) {
        var value = computed.getPropertyValue(property);

        if (!meaningfulStyleValue(value)) {
          return;
        }

        value = normalisePaintServer(value.trim());

        try {
          clone.setAttribute(property, value);
        } catch (error) {
          // Ignore unsupported presentation attributes.
        }
      });

      if (source.tagName && source.tagName.toLowerCase() === "text") {
        var textFill = computed.getPropertyValue("fill");
        var textColor = computed.getPropertyValue("color");
        var resolvedTextColour =
          meaningfulStyleValue(textFill) && textFill !== "none"
            ? textFill
            : textColor;

        if (meaningfulStyleValue(resolvedTextColour)) {
          clone.setAttribute("fill", resolvedTextColour.trim());
        }
      }
    }
  }

  function elementTextLines(element) {
    var html = element.cloneNode(true);

    Array.prototype.forEach.call(html.querySelectorAll("br"), function (br) {
      br.replaceWith("\n");
    });

    Array.prototype.forEach.call(
      html.querySelectorAll("div, p, li"),
      function (block) {
        block.appendChild(document.createTextNode("\n"));
      }
    );

    var text = typeof element.innerText === "string"
      ? element.innerText
      : html.textContent;

    return text
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map(function (line) {
        return line.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  }

  function numericAttribute(element, name, fallback) {
    var value = parseFloat(element.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function replaceForeignObjects(sourceSvg, clonedSvg) {
    var sourceObjects = Array.prototype.slice.call(
      sourceSvg.querySelectorAll("foreignObject")
    );
    var clonedObjects = Array.prototype.slice.call(
      clonedSvg.querySelectorAll("foreignObject")
    );

    sourceObjects.forEach(function (sourceObject, index) {
      var clonedObject = clonedObjects[index];
      if (!clonedObject || !clonedObject.parentNode) {
        return;
      }

      var labelElement =
        sourceObject.querySelector(".nodeLabel, .edgeLabel, .label, span, div") ||
        sourceObject;
      var lines = elementTextLines(labelElement);

      if (!lines.length) {
        clonedObject.remove();
        return;
      }

      var box;
      try {
        box = sourceObject.getBBox();
      } catch (error) {
        box = null;
      }

      var x = box ? box.x : numericAttribute(sourceObject, "x", 0);
      var y = box ? box.y : numericAttribute(sourceObject, "y", 0);
      var width = box
        ? box.width
        : numericAttribute(sourceObject, "width", 1);
      var height = box
        ? box.height
        : numericAttribute(sourceObject, "height", 1);
      var computed = window.getComputedStyle(labelElement);
      var fontSize = parseFloat(computed.fontSize) || 14;
      var lineHeight = fontSize * 1.22;
      var centreX = x + width / 2;
      var centreY = y + height / 2;
      var firstLineY = centreY - ((lines.length - 1) * lineHeight) / 2;
      var text = document.createElementNS(SVG_NS, "text");
      var textColour = computed.color || computed.fill || "#111827";

      text.setAttribute("x", String(centreX));
      text.setAttribute("y", String(firstLineY));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("fill", textColour);
      text.setAttribute(
        "font-family",
        computed.fontFamily || "Arial, Helvetica, sans-serif"
      );
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("font-weight", computed.fontWeight || "400");
      text.setAttribute("font-style", computed.fontStyle || "normal");
      text.setAttribute("class", "caat-exported-mermaid-label");

      lines.forEach(function (line, lineIndex) {
        var tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(centreX));
        tspan.setAttribute(
          "y",
          String(firstLineY + lineIndex * lineHeight)
        );
        tspan.textContent = line;
        text.appendChild(tspan);
      });

      clonedObject.parentNode.replaceChild(text, clonedObject);
    });
  }

  function parseViewBox(svg, rect) {
    var viewBox = svg.getAttribute("viewBox");

    if (viewBox) {
      var parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (parts.length === 4 && parts.every(Number.isFinite)) {
        return {
          x: parts[0],
          y: parts[1],
          width: Math.max(parts[2], 1),
          height: Math.max(parts[3], 1)
        };
      }
    }

    var width =
      parseFloat(svg.getAttribute("width")) || rect.width || svg.clientWidth || 1;
    var height =
      parseFloat(svg.getAttribute("height")) ||
      rect.height ||
      svg.clientHeight ||
      1;

    return { x: 0, y: 0, width: width, height: height };
  }

  function effectiveBackground(mermaidElement) {
    var candidates = [
      mermaidElement,
      mermaidElement.parentElement,
      document.body,
      document.documentElement
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      var element = candidates[index];
      if (!element) {
        continue;
      }

      var background = window
        .getComputedStyle(element)
        .getPropertyValue("background-color");

      if (
        background &&
        background !== "transparent" &&
        background !== "rgba(0, 0, 0, 0)"
      ) {
        return background;
      }
    }

    return document.documentElement.dataset.theme === "dark"
      ? "#111923"
      : "#ffffff";
  }

  function insertBackground(clonedSvg, box, colour) {
    var background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", String(box.x));
    background.setAttribute("y", String(box.y));
    background.setAttribute("width", String(box.width));
    background.setAttribute("height", String(box.height));
    background.setAttribute("fill", colour);
    background.setAttribute("stroke", "none");
    background.setAttribute("class", "caat-mermaid-export-background");

    var defs = clonedSvg.querySelector(":scope > defs");
    if (defs && defs.nextSibling) {
      clonedSvg.insertBefore(background, defs.nextSibling);
    } else if (defs) {
      clonedSvg.appendChild(background);
    } else {
      clonedSvg.insertBefore(background, clonedSvg.firstChild);
    }
  }

  /*
   * CaaT export-only Mermaid edge-label normalization.
   *
   * Connector-line explanations inherit the active webpage theme. In dark
   * mode they may be exported as near-white text and disappear when the
   * transparent image is placed on a light slide. Normalize only the cloned
   * export SVG: dark ink with a narrow white halo. The live page is untouched.
   */
  function normaliseExportedEdgeLabels(clonedSvg) {
    var selector = [
      ".edgeLabel text",
      ".edgeLabels text",
      "text.edgeLabel",
      ".edgeLabel .caat-exported-mermaid-label",
      ".edgeLabels .caat-exported-mermaid-label"
    ].join(", ");

    Array.prototype.forEach.call(
      clonedSvg.querySelectorAll(selector),
      function (textElement) {
        var parts = [textElement].concat(
          Array.prototype.slice.call(textElement.querySelectorAll("tspan"))
        );

        parts.forEach(function (part) {
          part.setAttribute("fill", "#111827");
          part.setAttribute("color", "#111827");
          part.setAttribute("stroke", "#ffffff");
          part.setAttribute("stroke-opacity", "0.96");
          part.setAttribute("stroke-width", "2.4");
          part.setAttribute("stroke-linejoin", "round");
          part.setAttribute("paint-order", "stroke fill");
        });
      }
    );
  }

  function buildStandaloneSvg(sourceSvg, mermaidElement) {
    var rect = sourceSvg.getBoundingClientRect();
    var box = parseViewBox(sourceSvg, rect);
    var clonedSvg = sourceSvg.cloneNode(true);

    inlineComputedStyles(sourceSvg, clonedSvg);
    replaceForeignObjects(sourceSvg, clonedSvg);
    normaliseExportedEdgeLabels(clonedSvg);

    Array.prototype.forEach.call(
      clonedSvg.querySelectorAll("style, script"),
      function (element) {
        element.remove();
      }
    );

    clonedSvg.setAttribute("xmlns", SVG_NS);
    clonedSvg.setAttribute("xmlns:xlink", XLINK_NS);
    clonedSvg.setAttribute("version", "1.1");
    clonedSvg.setAttribute("viewBox", [box.x, box.y, box.width, box.height].join(" "));
    clonedSvg.setAttribute("width", String(box.width));
    clonedSvg.setAttribute("height", String(box.height));
    clonedSvg.setAttribute("shape-rendering", "geometricPrecision");
    clonedSvg.setAttribute("text-rendering", "geometricPrecision");
    clonedSvg.removeAttribute("style");

    insertBackground(clonedSvg, box, effectiveBackground(mermaidElement));

    /* CaaT small visual patch: transparent Mermaid downloads
     * Keep all node, edge, text, and theme colours, but make only the
     * exported canvas/background transparent for both SVG and PNG files.
     */
    var exportBackground = clonedSvg.querySelector(
      ".caat-mermaid-export-background"
    );

    if (exportBackground) {
      exportBackground.setAttribute("fill", "none");
      exportBackground.setAttribute("fill-opacity", "0");
    }

    clonedSvg.setAttribute(
      "style",
      "background: transparent; background-color: transparent;"
    );


    var serialised = new XMLSerializer().serializeToString(clonedSvg);
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialised;

    return {
      xml: xml,
      width: box.width,
      height: box.height
    };
  }

  function safeFilename(value) {
    return value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 120) || "mermaid-diagram";
  }

  function diagramFilename(mermaidElement, extension) {
    var section = mermaidElement.closest("section");
    var heading = section && section.querySelector("h1, h2, h3, h4");
    var title = heading ? heading.textContent.trim() : document.title.trim();
    var index = mermaidElement.dataset.caatMermaidExportIndex || "1";

    return safeFilename(title + " - diagram " + index) + "." + extension;
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function svgToPng(exported, filename) {
    return new Promise(function (resolve, reject) {
      var svgBlob = new Blob([exported.xml], {
        type: "image/svg+xml;charset=utf-8"
      });
      var svgUrl = URL.createObjectURL(svgBlob);
      var image = new Image();

      image.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          var width = Math.max(1, Math.ceil(exported.width * PNG_SCALE));
          var height = Math.max(1, Math.ceil(exported.height * PNG_SCALE));
          var pixelCount = width * height;

          if (pixelCount > 120000000) {
            throw new Error(
              "The 4x PNG would exceed the browser canvas limit. Save as SVG instead."
            );
          }

          canvas.width = width;
          canvas.height = height;

          var context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas rendering is unavailable in this browser.");
          }

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, width, height);

          canvas.toBlob(
            function (blob) {
              URL.revokeObjectURL(svgUrl);

              if (!blob) {
                reject(new Error("The browser could not create the PNG file."));
                return;
              }

              triggerDownload(blob, filename);
              resolve();
            },
            "image/png",
            1
          );
        } catch (error) {
          URL.revokeObjectURL(svgUrl);
          reject(error);
        }
      };

      image.onerror = function () {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("The diagram could not be rasterised."));
      };

      image.src = svgUrl;
    });
  }

  function setButtonState(button, state, temporaryLabel) {
    var label = button.querySelector(".caat-mermaid-export-btn__label");
    var originalLabel = button.dataset.originalLabel || (label && label.textContent);

    if (originalLabel) {
      button.dataset.originalLabel = originalLabel;
    }

    button.classList.remove("is-busy", "is-success", "is-error");
    button.disabled = false;

    if (state === "busy") {
      button.classList.add("is-busy");
      button.disabled = true;
    } else if (state === "success") {
      button.classList.add("is-success");
    } else if (state === "error") {
      button.classList.add("is-error");
    }

    if (label && temporaryLabel) {
      label.textContent = temporaryLabel;
    }

    if (state === "success" || state === "error") {
      window.setTimeout(function () {
        button.classList.remove("is-success", "is-error");
        if (label && button.dataset.originalLabel) {
          label.textContent = button.dataset.originalLabel;
        }
      }, 1800);
    }
  }

  function exportDiagram(mermaidElement, format, button) {
    var svg = mermaidElement.querySelector("svg");

    if (!svg) {
      setButtonState(button, "error", "Not ready");
      return;
    }

    setButtonState(button, "busy", "Working");

    try {
      var exported = buildStandaloneSvg(svg, mermaidElement);

      if (format === "svg") {
        triggerDownload(
          new Blob([exported.xml], { type: "image/svg+xml;charset=utf-8" }),
          diagramFilename(mermaidElement, "svg")
        );
        setButtonState(button, "success", "Saved");
        return;
      }

      svgToPng(exported, diagramFilename(mermaidElement, "png"))
        .then(function () {
          setButtonState(button, "success", "Saved");
        })
        .catch(function (error) {
          console.error("CaaT Academy: Mermaid PNG export failed.", error);
          setButtonState(button, "error", "Failed");
        });
    } catch (error) {
      console.error("CaaT Academy: Mermaid export failed.", error);
      setButtonState(button, "error", "Failed");
    }
  }

  function createButton(format, mermaidElement) {
    var button = document.createElement("button");
    var upperFormat = format.toUpperCase();

    button.type = "button";
    button.className = "caat-mermaid-export-btn";
    button.dataset.format = format;
    button.setAttribute("aria-label", "Save Mermaid diagram as " + upperFormat);
    button.setAttribute("title", "Save as " + upperFormat);
    button.innerHTML =
      '<span class="caat-mermaid-export-btn__icon fa fa-download" aria-hidden="true"></span>' +
      '<span class="caat-mermaid-export-btn__label">' +
      upperFormat +
      "</span>";

    button.addEventListener("click", function () {
      exportDiagram(mermaidElement, format, button);
    });

    return button;
  }

  function ensureHost(mermaidElement) {
    var host = mermaidElement.closest(".diagram-wrapper");
    var needsDedicatedFrame =
      !host || host.querySelectorAll(MERMAID_SELECTOR).length > 1;

    if (needsDedicatedFrame) {
      host = document.createElement("div");
      host.className = "caat-mermaid-export-frame";
      mermaidElement.parentNode.insertBefore(host, mermaidElement);
      host.appendChild(mermaidElement);
    }

    host.classList.add("caat-mermaid-export-host");
    return host;
  }

  function mountControls(mermaidElement) {
    if (!mermaidElement.dataset.caatMermaidExportIndex) {
      diagramCounter += 1;
      mermaidElement.dataset.caatMermaidExportIndex = String(diagramCounter);
    }

    var host = ensureHost(mermaidElement);
    var controls = host.querySelector(":scope > .caat-mermaid-export-controls");

    if (!controls) {
      controls = document.createElement("div");
      controls.className = "caat-mermaid-export-controls";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "Mermaid diagram downloads");
      controls.appendChild(createButton("svg", mermaidElement));
      controls.appendChild(createButton("png", mermaidElement));
      host.insertBefore(controls, host.firstChild);
    }

    var ready = Boolean(mermaidElement.querySelector("svg"));
    controls.querySelectorAll("button").forEach(function (button) {
      if (!button.classList.contains("is-busy")) {
        button.disabled = !ready;
      }
    });
  }

  function scan() {
    document.querySelectorAll(MERMAID_SELECTOR).forEach(mountControls);
  }

  function scheduleScan(delay) {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, typeof delay === "number" ? delay : 40);
  }

  function startObserver() {
    if (!document.body || typeof MutationObserver !== "function") {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        return mutation.type === "childList" &&
          (mutation.addedNodes.length || mutation.removedNodes.length);
      });

      if (relevant) {
        scheduleScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function initialise() {
    scan();
    startObserver();
    window.addEventListener("load", function () {
      scheduleScan(160);
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
