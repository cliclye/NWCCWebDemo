document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: "0px 0px -10% 0px" }) : null;

  document.querySelectorAll(".reveal").forEach((element) => {
    if (!observer) element.classList.add("is-visible");
    else observer.observe(element);
  });

  const zoomSelector = ".gallery-tile img, .media-grid img, .image-card img, .article-cover, .person-card img";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeZoom = null;
  let activeUpdatesZoom = null;

  function setPanelRect(panel, rect, radius) {
    panel.style.width = rect.width + "px";
    panel.style.height = rect.height + "px";
    panel.style.transform = "translate3d(" + rect.left + "px, " + rect.top + "px, 0)";
    panel.style.borderRadius = radius;
  }

  function measureUpdatesPanelHeight(innerRoot, maxWidthPx) {
    const inner = innerRoot.cloneNode(true);
    const scroll = document.createElement("div");
    scroll.className = "updates-zoom-scroll";
    scroll.append(inner);
    const shell = document.createElement("div");
    shell.style.cssText = "position:fixed;left:-9999px;top:0;width:" + maxWidthPx + "px;visibility:hidden;pointer-events:none";
    shell.append(scroll);
    document.body.append(shell);
    const h = scroll.scrollHeight;
    shell.remove();
    return h;
  }

  function updatesTargetRect(template) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(640, viewportWidth * 0.92);
    const maxHeight = viewportHeight * 0.86;
    const innerRoot = template.content.firstElementChild;
    if (!innerRoot) return null;
    const contentH = measureUpdatesPanelHeight(innerRoot, maxWidth);
    const height = Math.min(Math.max(contentH, 80), maxHeight);
    const width = maxWidth;
    return {
      width,
      height,
      left: (viewportWidth - width) / 2,
      top: (viewportHeight - height) / 2,
    };
  }

  function cleanupUpdatesZoom(state) {
    state.overlay.remove();
    state.panel.remove();
    document.removeEventListener("keydown", state.onEscape);
    if (activeUpdatesZoom === state) activeUpdatesZoom = null;
    if (state.source) {
      state.source.setAttribute("aria-expanded", "false");
      state.source.focus();
    }
  }

  function closeUpdatesZoom(state) {
    if (!state || state.isClosing) return;
    state.isClosing = true;
    const end = state.source.getBoundingClientRect();
    const endRadius = getComputedStyle(state.source).borderRadius || state.radius;
    state.overlay.classList.remove("is-open");
    state.panel.classList.remove("is-open");

    if (!reducedMotion.matches && end.width > 4 && end.height > 4) {
      setPanelRect(state.panel, end, endRadius);
      window.setTimeout(() => cleanupUpdatesZoom(state), 700);
      return;
    }

    cleanupUpdatesZoom(state);
  }

  function closeAnyUpdatesZoom() {
    if (activeUpdatesZoom) closeUpdatesZoom(activeUpdatesZoom);
  }

  function openUpdatesZoom(source, template) {
    if (activeZoom) closeImageZoom(activeZoom);
    if (activeUpdatesZoom) closeUpdatesZoom(activeUpdatesZoom);

    const start = source.getBoundingClientRect();
    if (start.width < 8 || start.height < 8) return;

    const target = updatesTargetRect(template);
    if (!target) return;

    const overlay = document.createElement("button");
    overlay.className = "image-zoom-overlay";
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Close notice");

    const panel = document.createElement("div");
    panel.id = "updates-zoom-root";
    panel.className = "updates-zoom-clone";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Full important updates notice");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "updates-zoom-close";
    closeBtn.textContent = "Close";

    const scroll = document.createElement("div");
    scroll.className = "updates-zoom-scroll";
    scroll.append(template.content.firstElementChild.cloneNode(true));
    panel.append(closeBtn, scroll);

    const radius = getComputedStyle(source).borderRadius || "8px";
    const state = {
      overlay,
      panel,
      source,
      radius,
      isClosing: false,
      onEscape(event) {
        if (event.key === "Escape") closeUpdatesZoom(state);
      },
    };

    activeUpdatesZoom = state;
    source.setAttribute("aria-expanded", "true");
    document.body.append(overlay, panel);
    document.addEventListener("keydown", state.onEscape);

    overlay.addEventListener("click", () => closeUpdatesZoom(state));
    closeBtn.addEventListener("click", () => closeUpdatesZoom(state));

    const runOpen = () => {
      overlay.classList.add("is-open");
      panel.classList.add("is-open");
      setPanelRect(panel, target, "10px");
    };

    if (reducedMotion.matches) {
      setPanelRect(panel, target, "10px");
      overlay.classList.add("is-open");
      panel.classList.add("is-open");
    } else {
      setPanelRect(panel, start, radius);
      requestAnimationFrame(() => requestAnimationFrame(runOpen));
    }

    requestAnimationFrame(() => closeBtn.focus());
  }

  function targetRectFor(source, clone) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = viewportWidth * .9;
    const maxHeight = viewportHeight * .86;
    const sourceRatio = source.width / Math.max(source.height, 1);
    const naturalRatio = clone.naturalWidth && clone.naturalHeight ? clone.naturalWidth / clone.naturalHeight : sourceRatio;
    let width = maxWidth;
    let height = width / naturalRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * naturalRatio;
    }

    return {
      width,
      height,
      left: (viewportWidth - width) / 2,
      top: (viewportHeight - height) / 2,
    };
  }

  function setCloneRect(clone, rect, radius) {
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    clone.style.transform = "translate3d(" + rect.left + "px, " + rect.top + "px, 0)";
    clone.style.borderRadius = radius;
  }

  function cleanupZoom(state) {
    state.overlay.remove();
    state.clone.remove();
    document.removeEventListener("keydown", state.onEscape);
    if (activeZoom === state) activeZoom = null;
  }

  function closeImageZoom(state) {
    if (!state || state.isClosing) return;
    state.isClosing = true;
    const end = state.source.getBoundingClientRect();
    const endRadius = getComputedStyle(state.source).borderRadius || state.radius;
    state.overlay.classList.remove("is-open");
    state.clone.classList.remove("is-open");

    if (!reducedMotion.matches && end.width > 4 && end.height > 4) {
      setCloneRect(state.clone, end, endRadius);
      state.clone.addEventListener("transitionend", () => cleanupZoom(state), { once: true });
      window.setTimeout(() => cleanupZoom(state), 760);
      return;
    }

    cleanupZoom(state);
  }

  function openImageZoom(source) {
    closeAnyUpdatesZoom();
    if (activeZoom) closeImageZoom(activeZoom);

    const start = source.getBoundingClientRect();
    if (start.width < 12 || start.height < 12) return;

    const overlay = document.createElement("button");
    overlay.className = "image-zoom-overlay";
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Close image preview");

    const clone = document.createElement("img");
    clone.className = "image-zoom-clone";
    clone.src = source.currentSrc || source.src;
    clone.alt = source.alt || "";

    const radius = getComputedStyle(source).borderRadius || "8px";
    const state = {
      overlay,
      clone,
      source,
      radius,
      isClosing: false,
      onEscape(event) {
        if (event.key === "Escape") closeImageZoom(state);
      },
    };

    activeZoom = state;
    setCloneRect(clone, start, radius);
    document.body.append(overlay, clone);
    document.addEventListener("keydown", state.onEscape);

    const open = () => {
      const target = targetRectFor(start, clone);
      overlay.classList.add("is-open");
      clone.classList.add("is-open");
      setCloneRect(clone, target, "8px");
    };

    overlay.addEventListener("click", () => closeImageZoom(state));
    clone.addEventListener("click", () => closeImageZoom(state));

    if (clone.complete) {
      requestAnimationFrame(() => requestAnimationFrame(open));
    } else {
      clone.addEventListener("load", () => requestAnimationFrame(() => requestAnimationFrame(open)), { once: true });
    }
  }

  document.querySelectorAll(zoomSelector).forEach((img) => {
    if (img.closest(".brand") || img.classList.contains("hero-bg")) return;
    img.classList.add("zoomable-image");
    const zoomButton = img.closest(".gallery-tile");

    if (!img.closest("a, button")) {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "View larger image");
    }

    if (zoomButton) {
      zoomButton.setAttribute("aria-label", "View larger image");
      zoomButton.addEventListener("click", (event) => {
        event.preventDefault();
        openImageZoom(img);
      });
    }

    img.addEventListener("click", (event) => {
      if (img.closest("a")) return;
      event.preventDefault();
      event.stopPropagation();
      openImageZoom(img);
    });

    img.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openImageZoom(img);
    });
  });

  const updatesOpen = document.querySelector("#updates-teaser-open");
  const updatesTemplate = document.querySelector("#updates-full-template");
  if (updatesOpen && updatesTemplate) {
    updatesOpen.addEventListener("click", () => {
      openUpdatesZoom(updatesOpen, updatesTemplate);
    });
  }

  document.querySelectorAll("[data-static-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = form.querySelector(".form-message");
      if (message) message.textContent = "Thanks. Please email Admin@northwest-cc.org to complete signup.";
      form.reset();
    });
  });

  const galleryTabs = document.querySelector(".gallery-team-tabs");
  if (galleryTabs) {
    const tabLinks = [...galleryTabs.querySelectorAll('a[href^="#"]')];
    tabLinks.forEach((link) => {
      link.addEventListener("click", () => {
        tabLinks.forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
      });
    });

    const syncTabFromHash = () => {
      const hash = location.hash;
      if (!hash) return;
      const match = tabLinks.find((l) => l.getAttribute("href") === hash);
      if (!match) return;
      tabLinks.forEach((l) => l.classList.remove("is-active"));
      match.classList.add("is-active");
    };
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const hits = entries.filter((e) => e.isIntersecting && e.intersectionRatio > 0.12);
          if (!hits.length) return;
          hits.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          const id = "#" + hits[0].target.id;
          const match = tabLinks.find((l) => l.getAttribute("href") === id);
          if (!match) return;
          tabLinks.forEach((l) => l.classList.remove("is-active"));
          match.classList.add("is-active");
        },
        { rootMargin: "-12% 0px -58% 0px", threshold: [0, 0.12, 0.28, 0.5] }
      );
      tabLinks.forEach((link) => {
        const sel = link.getAttribute("href");
        const section = sel ? document.querySelector(sel) : null;
        if (section) observer.observe(section);
      });
    }
  }
});