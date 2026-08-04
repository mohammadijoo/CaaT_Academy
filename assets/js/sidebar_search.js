// sidebar_search.js
(function () {
  "use strict";

  function normalise(value) {
    var text = String(value || "").toLocaleLowerCase();
    if (typeof text.normalize === "function") {
      text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    }
    return text.replace(/\s+/g, " ").trim();
  }

  function isLessonLink(link) {
    if (!link) return false;
    if (link.dataset.chapter && link.dataset.lesson) return true;
    var href = link.getAttribute("href") || "";
    return /(?:^|\/)Chapter\d+\/Lesson\d+\.html(?:[?#].*)?$/i.test(href);
  }

  function directOpener(chapterItem) {
    if (!chapterItem) return null;
    for (var index = 0; index < chapterItem.children.length; index += 1) {
      var child = chapterItem.children[index];
      if (child.classList && child.classList.contains("opener")) {
        return child;
      }
    }
    return null;
  }

  function chapterItemFor(link, courseList) {
    var lessonList = link ? link.closest("ul") : null;
    if (!lessonList || lessonList === courseList) return null;
    var item = lessonList.parentElement;
    return item && item.tagName === "LI" ? item : null;
  }

  function makeEmptyMessage(courseList) {
    var existing = courseList.querySelector(".caat-sidebar-search-empty");
    if (existing) return existing;
    var item = document.createElement("li");
    item.className = "caat-sidebar-search-empty";
    item.hidden = true;
    item.setAttribute("role", "status");
    item.setAttribute("aria-live", "polite");
    item.textContent = "No matching lessons";
    item.style.padding = "0.75rem 0";
    item.style.opacity = "0.75";
    courseList.appendChild(item);
    return item;
  }

  function initialise() {
    var input =
      document.getElementById("sidebar-search-input") ||
      document.querySelector("#search input[name='search']");
    var menu = document.getElementById("menu");
    if (!input || !menu) return;

    var courseList = menu.querySelector("ul");
    if (!courseList) return;

    var links = Array.prototype.filter.call(
      menu.querySelectorAll("a[href]"),
      isLessonLink
    );
    if (!links.length) return;

    var chapterMap = new Map();
    links.forEach(function (link) {
      var lessonItem = link.closest("li");
      var chapterItem = chapterItemFor(link, courseList);
      if (!lessonItem || !chapterItem) return;
      if (!chapterMap.has(chapterItem)) {
        var opener = directOpener(chapterItem);
        chapterMap.set(chapterItem, {
          item: chapterItem,
          opener: opener,
          lessonRecords: [],
          originallyActive: Boolean(
            opener && opener.classList.contains("active")
          )
        });
      }
      chapterMap.get(chapterItem).lessonRecords.push({
        item: lessonItem,
        link: link
      });
    });

    var chapters = Array.from(chapterMap.values());
    var emptyMessage = makeEmptyMessage(courseList);

    function searchableLesson(record, chapter) {
      var link = record.link;
      return normalise(
        (chapter.opener ? chapter.opener.textContent : "") + " " +
        link.textContent + " " +
        (link.dataset.chapter || "") + " " +
        (link.dataset.lesson || "") + " " +
        (link.getAttribute("href") || "")
      );
    }

    function restoreChapterState(chapter) {
      if (!chapter.opener) return;
      var containsCurrent = Boolean(
        chapter.item.querySelector("a.active-lesson")
      );
      var shouldOpen = chapter.originallyActive || containsCurrent;
      chapter.opener.classList.toggle("active", shouldOpen);
      chapter.opener.setAttribute(
        "aria-expanded",
        shouldOpen ? "true" : "false"
      );
    }

    function filterLessons() {
      var query = normalise(input.value);
      var visibleLessons = 0;

      chapters.forEach(function (chapter) {
        var chapterText = normalise(
          chapter.opener ? chapter.opener.textContent : ""
        );
        var chapterMatches = Boolean(query && chapterText.indexOf(query) >= 0);
        var chapterVisible = false;

        chapter.lessonRecords.forEach(function (record) {
          var matches =
            !query ||
            chapterMatches ||
            searchableLesson(record, chapter).indexOf(query) >= 0;
          record.item.hidden = !matches;
          if (matches) {
            chapterVisible = true;
            visibleLessons += 1;
          }
        });

        chapter.item.hidden = Boolean(query) && !chapterVisible;
        if (chapter.opener) {
          if (query && chapterVisible) {
            chapter.opener.classList.add("active");
            chapter.opener.setAttribute("aria-expanded", "true");
          } else if (!query) {
            restoreChapterState(chapter);
          }
        }
      });

      emptyMessage.hidden = !query || visibleLessons > 0;
      input.setAttribute(
        "aria-label",
        query
          ? "Search course lessons, " + visibleLessons + " result(s)"
          : "Search course lessons"
      );

      document.dispatchEvent(
        new CustomEvent("caat:sidebar-search-updated", {
          detail: { query: query, visibleLessons: visibleLessons }
        })
      );

      if (window.jQuery) {
        window.jQuery(window).triggerHandler("resize.sidebar-lock");
      }
    }

    input.addEventListener("input", filterLessons);
    input.addEventListener("search", filterLessons);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && input.value) {
        input.value = "";
        filterLessons();
        input.focus();
      }
    });

    filterLessons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
