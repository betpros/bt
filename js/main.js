/* BetPro — shared site behaviour */
(function () {
  "use strict";

  /* Mobile nav toggle */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* Reveal-on-scroll */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* Current year in footer */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------------------------------------------------------------
     Generic form validation (Contact page, and any .validate-form)
     --------------------------------------------------------------------- */
  function showError(field, message) {
    field.classList.add("invalid");
    const err = field.querySelector(".field-error");
    if (err) err.textContent = message;
  }
  function clearError(field) {
    field.classList.remove("invalid");
  }

  function validateField(field) {
    const input = field.querySelector("input, textarea, select");
    if (!input) return true;
    const value = input.value.trim();

    if (input.hasAttribute("required") && !value) {
      showError(field, "This field is required.");
      return false;
    }
    if (input.type === "email" && value) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        showError(field, "Enter a valid email address.");
        return false;
      }
    }
    if (input.type === "tel" && value) {
      const phoneRe = /^(?:\+254|0)7\d{8}$|^(?:\+254|0)1\d{8}$/;
      if (!phoneRe.test(value.replace(/\s+/g, ""))) {
        showError(field, "Enter a valid Kenyan phone number, e.g. 07XXXXXXXX.");
        return false;
      }
    }
    clearError(field);
    return true;
  }

  document.querySelectorAll("form.validate-form").forEach((form) => {
    const fields = form.querySelectorAll(".field");
    fields.forEach((field) => {
      const input = field.querySelector("input, textarea, select");
      if (!input) return;
      input.addEventListener("blur", () => validateField(field));
      input.addEventListener("input", () => {
        if (field.classList.contains("invalid")) validateField(field);
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let valid = true;
      fields.forEach((field) => {
        if (!validateField(field)) valid = false;
      });
      if (!valid) {
        const firstInvalid = form.querySelector(".field.invalid input, .field.invalid textarea, .field.invalid select");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const successBox = form.parentElement.querySelector(".form-success") || form.querySelector(".form-success");
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending...";
      }

      /* Simulated submit — wire this up to your backend / email service */
      setTimeout(() => {
        if (successBox) successBox.classList.add("show");
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "Send Message";
        }
        if (successBox) successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 900);
    });
  });
})();
