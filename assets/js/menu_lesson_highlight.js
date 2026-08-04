// menu_lesson_highlight.js
(function () {
  "use strict";

  function getElements() {
    return {
      lesson: document.querySelector("#sidebar a.active-lesson"),
      sidebar: document.querySelector("#sidebar .inner")
    };
  }

  function openCurrentChapter(lesson) {
    var list = lesson ? lesson.closest("ul") : null;
    var opener = list ? list.previousElementSibling : null;
    if (opener && opener.classList.contains("opener")) {
      opener.classList.add("active");
      opener.setAttribute("aria-expanded", "true");
    }
  }

  function centerCurrentLesson() {
    var current = getElements();
    if (!current.lesson) return;
    openCurrentChapter(current.lesson);

    if (!current.sidebar) {
      current.lesson.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "auto"
      });
      return;
    }

    var sidebarRect = current.sidebar.getBoundingClientRect();
    var lessonRect = current.lesson.getBoundingClientRect();
    var target =
      current.sidebar.scrollTop +
      (lessonRect.top - sidebarRect.top) -
      (current.sidebar.clientHeight / 2 - lessonRect.height / 2);
    var maximum = Math.max(
      0,
      current.sidebar.scrollHeight - current.sidebar.clientHeight
    );

    current.sidebar.scrollTo({
      top: Math.max(0, Math.min(maximum, target)),
      behavior: "auto"
    });
  }

  function afterLayoutSettles() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(centerCurrentLesson);
    });
  }

  function initialise() {
    var current = getElements();
    if (!current.lesson) return;

    openCurrentChapter(current.lesson);
    afterLayoutSettles();

    if (document.readyState === "complete") {
      afterLayoutSettles();
    } else {
      window.addEventListener("load", afterLayoutSettles, { once: true });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(afterLayoutSettles).catch(function () {});
    }

    if (
      window.MathJax &&
      MathJax.Hub &&
      typeof MathJax.Hub.Queue === "function"
    ) {
      MathJax.Hub.Queue(afterLayoutSettles);
    }

    document.addEventListener(
      "caat:sidebar-search-updated",
      afterLayoutSettles
    );

    var timer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(afterLayoutSettles, 100);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
