(function () {
  "use strict";

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.select();

    var successful = false;

    try {
      successful = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    if (!successful) {
      throw new Error("Copy command failed.");
    }
  }

  function setState(button, state) {
    var icon = button.querySelector("i");
    var label = button.querySelector("[data-copy-label]");

    button.classList.remove("is-copied", "is-error");

    if (state === "copied") {
      button.classList.add("is-copied");

      if (icon) {
        icon.className = "fa fa-check";
      }

      if (label) {
        label.textContent = "Copied";
      }

      button.title = "Ethereum address copied";
      return;
    }

    if (state === "error") {
      button.classList.add("is-error");

      if (icon) {
        icon.className = "fa fa-exclamation-triangle";
      }

      if (label) {
        label.textContent = "Copy failed";
      }

      button.title = "Could not copy Ethereum address";
      return;
    }

    if (icon) {
      icon.className = "fa fa-copy";
    }

    if (label) {
      label.textContent = "Copy address";
    }

    button.title = "Copy Ethereum donation address";
  }

  function bindButton(button) {
    if (button.dataset.copyBound === "true") {
      return;
    }

    button.dataset.copyBound = "true";

    button.addEventListener("click", function () {
      var section = button.closest(".caat-support-section");
      var addressElement = section
        ? section.querySelector("[data-wallet-address]")
        : null;

      var address = addressElement
        ? (
            addressElement.getAttribute("data-address") ||
            addressElement.textContent
          ).trim()
        : "";

      if (!address) {
        setState(button, "error");

        window.setTimeout(function () {
          setState(button, "idle");
        }, 1800);

        return;
      }

      var promise;

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        promise = navigator.clipboard.writeText(address);
      } else {
        promise = new Promise(function (resolve, reject) {
          try {
            fallbackCopy(address);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }

      promise
        .then(function () {
          setState(button, "copied");
        })
        .catch(function () {
          setState(button, "error");
        });

      window.setTimeout(function () {
        setState(button, "idle");
      }, 1800);
    });
  }

  function initialise() {
    document
      .querySelectorAll("[data-copy-wallet]")
      .forEach(function (button) {
        bindButton(button);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
  } else {
    initialise();
  }
})();
