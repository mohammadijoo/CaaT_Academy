/* CaaT Academy theme controller — revision 2
 *
 * - Applies the saved theme before body rendering.
 * - Injects a cat-sized accessible theme button.
 * - Switches the Highlight.js GitHub stylesheet between light and dark.
 * - Re-renders Mermaid diagrams with theme-specific variables.
 * - Uses the operating-system preference until the visitor chooses a theme.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "caat-academy-theme";
  var ROOT = document.documentElement;
  var mediaQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  var mermaidRenderTimer = null;

  function isValidTheme(value) {
    return value === "light" || value === "dark";
  }

  function readStoredTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return isValidTheme(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function systemTheme() {
    return mediaQuery && mediaQuery.matches ? "dark" : "light";
  }

  function currentTheme() {
    return isValidTheme(ROOT.dataset.theme)
      ? ROOT.dataset.theme
      : readStoredTheme() || systemTheme();
  }

  function updateButtons(theme) {
    var isDark = theme === "dark";
    var actionLabel = isDark
      ? "Switch to light theme"
      : "Switch to dark theme";

    document.querySelectorAll(".caat-theme-toggle").forEach(function (button) {
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("title", actionLabel);
      button.setAttribute("aria-pressed", String(isDark));

      var icon = button.querySelector("i");
      if (icon) {
        icon.className = isDark ? "fa fa-sun-o" : "fa fa-moon-o";
      }

      var text = button.querySelector(".caat-theme-toggle__text");
      if (text) {
        text.textContent = isDark ? "Light" : "Dark";
      }
    });
  }

  function highlightStylesheet() {
    return document.querySelector(
      'link[rel="stylesheet"][href*="highlightjs"][href*="/styles/"]'
    );
  }

  function prepareHighlightStylesheet(link) {
    if (!link || link.dataset.caatHighlightLight) {
      return;
    }

    var href = link.getAttribute("href") || "";
    var lightHref;
    var darkHref;

    if (/github-dark(?:\.min)?\.css/i.test(href)) {
      darkHref = href;
      lightHref = href.replace(
        /github-dark(\.min)?\.css/i,
        function (_, minPart) {
          return "github" + (minPart || "") + ".css";
        }
      );
    } else if (/github(?:\.min)?\.css/i.test(href)) {
      lightHref = href;
      darkHref = href.replace(
        /github(\.min)?\.css/i,
        function (_, minPart) {
          return "github-dark" + (minPart || "") + ".css";
        }
      );
    } else {
      lightHref =
        "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css";
      darkHref =
        "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css";
    }

    link.dataset.caatHighlightLight = lightHref;
    link.dataset.caatHighlightDark = darkHref;
  }

  function updateHighlightTheme(theme) {
    var link = highlightStylesheet();
    if (!link) {
      return;
    }

    prepareHighlightStylesheet(link);
    var nextHref =
      theme === "dark"
        ? link.dataset.caatHighlightDark
        : link.dataset.caatHighlightLight;

    if (nextHref && link.getAttribute("href") !== nextHref) {
      link.setAttribute("href", nextHref);
    }
  }

  function rememberMermaidSources() {
    document.querySelectorAll(".mermaid").forEach(function (element) {
      if (element.dataset.caatMermaidSource) {
        return;
      }

      var containsRenderedSvg = Boolean(element.querySelector("svg"));
      var source = containsRenderedSvg ? "" : element.textContent.trim();

      if (source) {
        element.dataset.caatMermaidSource = source;
      }
    });
  }

  function mermaidConfiguration(theme) {
    var isDark = theme === "dark";

    return {
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      fontFamily:
        'Inter, "Roboto Slab", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      themeVariables: isDark
        ? {
            darkMode: true,
            background: "#111923",
            primaryColor: "#173743",
            primaryTextColor: "#edf8fa",
            primaryBorderColor: "#65d0dc",
            secondaryColor: "#1b2942",
            secondaryTextColor: "#edf8fa",
            secondaryBorderColor: "#7aa7d9",
            tertiaryColor: "#1d2732",
            tertiaryTextColor: "#edf8fa",
            tertiaryBorderColor: "#8296a5",
            lineColor: "#9ccbd1",
            textColor: "#edf8fa",
            mainBkg: "#173743",
            nodeBorder: "#65d0dc",
            clusterBkg: "#16222c",
            clusterBorder: "#58737c",
            edgeLabelBackground: "#111923",
            titleColor: "#f4f8fa",
            actorBkg: "#173743",
            actorBorder: "#65d0dc",
            actorTextColor: "#edf8fa",
            signalColor: "#d7e7eb",
            signalTextColor: "#edf8fa",
            labelBoxBkgColor: "#16222c",
            labelBoxBorderColor: "#58737c",
            labelTextColor: "#edf8fa",
            loopTextColor: "#edf8fa",
            noteBkgColor: "#2d3440",
            noteBorderColor: "#aab9c4",
            noteTextColor: "#f3f6f8"
          }
        : {
            darkMode: false,
            background: "#ffffff",
            primaryColor: "#e4f1f3",
            primaryTextColor: "#17313a",
            primaryBorderColor: "#397784",
            secondaryColor: "#edf2fb",
            secondaryTextColor: "#25384d",
            secondaryBorderColor: "#708eaf",
            tertiaryColor: "#f4f7f9",
            tertiaryTextColor: "#253440",
            tertiaryBorderColor: "#93a5b0",
            lineColor: "#587680",
            textColor: "#17313a",
            mainBkg: "#e4f1f3",
            nodeBorder: "#397784",
            clusterBkg: "#f3f7f8",
            clusterBorder: "#91a9af",
            edgeLabelBackground: "#ffffff",
            titleColor: "#12222d",
            actorBkg: "#e4f1f3",
            actorBorder: "#397784",
            actorTextColor: "#17313a",
            signalColor: "#405d66",
            signalTextColor: "#17313a",
            labelBoxBkgColor: "#f3f7f8",
            labelBoxBorderColor: "#91a9af",
            labelTextColor: "#17313a",
            loopTextColor: "#17313a",
            noteBkgColor: "#fff8d8",
            noteBorderColor: "#a48b39",
            noteTextColor: "#342d17"
          }
    };
  }

  function renderMermaid(theme) {
    if (
      !window.mermaid ||
      typeof window.mermaid.initialize !== "function" ||
      typeof window.mermaid.run !== "function"
    ) {
      return;
    }

    rememberMermaidSources();

    var nodes = Array.prototype.filter.call(
      document.querySelectorAll(".mermaid"),
      function (element) {
        return Boolean(element.dataset.caatMermaidSource);
      }
    );

    if (!nodes.length) {
      return;
    }

    nodes.forEach(function (element) {
      element.removeAttribute("data-processed");
      element.innerHTML = element.dataset.caatMermaidSource;
    });

    try {
      window.mermaid.initialize(mermaidConfiguration(theme));
      Promise.resolve(
        window.mermaid.run({
          nodes: nodes,
          suppressErrors: true
        })
      ).catch(function (error) {
        console.warn("CaaT Academy: Mermaid theme refresh failed.", error);
      });
    } catch (error) {
      console.warn("CaaT Academy: Mermaid theme refresh failed.", error);
    }
  }

  function scheduleMermaidRender(theme, delay) {
    window.clearTimeout(mermaidRenderTimer);
    mermaidRenderTimer = window.setTimeout(function () {
      renderMermaid(theme);
    }, typeof delay === "number" ? delay : 60);
  }

  function applyTheme(theme, persist) {
    var nextTheme = isValidTheme(theme) ? theme : systemTheme();

    ROOT.dataset.theme = nextTheme;
    ROOT.style.colorScheme = nextTheme;

    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch (error) {
        // The page still works when storage is unavailable or blocked.
      }
    }

    updateButtons(nextTheme);
    updateHighlightTheme(nextTheme);

    if (document.readyState !== "loading") {
      scheduleMermaidRender(nextTheme);
    }
  }

  function createToggleButton(extraClass) {
    var button = document.createElement("button");
    button.type = "button";
    button.className =
      "caat-theme-toggle" + (extraClass ? " " + extraClass : "");
    button.innerHTML =
      '<i class="fa fa-moon-o" aria-hidden="true"></i>' +
      '<span class="caat-theme-toggle__text">Dark</span>';

    button.addEventListener("click", function () {
      var nextTheme = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(nextTheme, true);
    });

    return button;
  }

  function mountHomepageToggle() {
    var header = document.querySelector(".crl-site-header");
    var brand = header && header.querySelector(".crl-brand");

    if (!header || !brand || header.querySelector(".caat-theme-toggle")) {
      return false;
    }

    var controls = document.createElement("div");
    controls.className = "caat-brand-controls";

    header.insertBefore(controls, brand);
    controls.appendChild(brand);
    controls.appendChild(createToggleButton("caat-theme-toggle--home"));
    return true;
  }

  function mountLessonToggle() {
    var logo = document.querySelector("#header .logo");

    if (!logo || logo.querySelector(".caat-theme-toggle")) {
      return false;
    }

    var button = createToggleButton("caat-theme-toggle--lesson");
    var logoImage = logo.querySelector("img");

    if (logoImage && logoImage.nextSibling) {
      logo.insertBefore(button, logoImage.nextSibling);
    } else if (logoImage) {
      logo.appendChild(button);
    } else {
      logo.insertBefore(button, logo.firstChild);
    }

    return true;
  }

  function mountToggle() {
    mountHomepageToggle() || mountLessonToggle();
    updateButtons(currentTheme());
  }

  function onDomReady() {
    rememberMermaidSources();
    mountToggle();
    updateHighlightTheme(currentTheme());
  }

  // Apply the theme immediately while this script is parsed in <head>.
  applyTheme(readStoredTheme() || systemTheme(), false);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
  } else {
    onDomReady();
  }

  // The page's existing Mermaid startOnLoad pass runs around this point.
  // Re-render shortly afterwards so the selected theme owns all SVG colours.
  window.addEventListener(
    "load",
    function () {
      rememberMermaidSources();
      scheduleMermaidRender(currentTheme(), 120);
    },
    { once: true }
  );

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY && isValidTheme(event.newValue)) {
      applyTheme(event.newValue, false);
    }
  });

  if (mediaQuery) {
    var handleSystemThemeChange = function (event) {
      if (!readStoredTheme()) {
        applyTheme(event.matches ? "dark" : "light", false);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }
})();
