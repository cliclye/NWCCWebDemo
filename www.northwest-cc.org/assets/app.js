document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const header = document.querySelector(".site-header");
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.prepend(progress);

  function syncScrollEffects() {
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const scrollAmount = window.scrollY / maxScroll;
    progress.style.transform = "scaleX(" + Math.min(Math.max(scrollAmount, 0), 1) + ")";
    document.documentElement.style.setProperty("--scroll-y", String(Math.round(window.scrollY)));
    header?.classList.toggle("is-compact", window.scrollY > 20);
  }

  let scrollTicking = false;
  const requestScrollSync = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      syncScrollEffects();
      scrollTicking = false;
    });
  };

  syncScrollEffects();
  window.addEventListener("scroll", requestScrollSync, { passive: true });
  window.addEventListener("resize", requestScrollSync);

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

  function applyPremiumCardTilt(root = document) {
    if (reducedMotion.matches || !window.matchMedia("(pointer: fine)").matches) return;
    const tiltSelector = ".story-card, .project-card, .person-card, .image-card, .updates-teaser, .flow-step, .cta-band";
    root.querySelectorAll(tiltSelector).forEach((element) => {
      if (element.dataset.tiltBound === "true") return;
      element.dataset.tiltBound = "true";
      element.classList.add("tilt-ready");
      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
        const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
        element.style.setProperty("--tilt-y", (x * 5.5).toFixed(2) + "deg");
        element.style.setProperty("--tilt-x", (-y * 5.5).toFixed(2) + "deg");
      });
      element.addEventListener("pointerleave", () => {
        element.style.setProperty("--tilt-y", "0deg");
        element.style.setProperty("--tilt-x", "0deg");
      });
    });
  }

  applyPremiumCardTilt();

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

  const ADMIN_STORAGE_KEY = "nwcc-admin-announcements";
  const ADMIN_SESSION_KEY = "nwcc-admin-session";
  const ADMIN_ATTEMPTS_KEY = "nwcc-admin-login-attempts";
  const ADMIN_LOCK_KEY = "nwcc-admin-login-lock-until";
  const ADMIN_USERNAME = "nwcc-admin";
  const ADMIN_PASSWORD_HASH = "0f6ad2da2a62f22d0313898f922f5645f58c8859b0e7f2b2acfa3293b8e5f48b";
  const MANAGED_ACCENTS = {
    forest: "#007a5a",
    blue: "#315f8c",
    gold: "#aa7a2a",
    coral: "#b85d49",
  };

  function loadManagedAnnouncements() {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "[]")
        .filter((item) => item && item.title && item.date)
        .sort((a, b) => {
          const featuredRank = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
          if (featuredRank) return featuredRank;
          const dateRank = String(b.date).localeCompare(String(a.date));
          if (dateRank) return dateRank;
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
    } catch {
      return [];
    }
  }

  function saveManagedAnnouncements(items) {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(items));
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function managedAccent(value) {
    return MANAGED_ACCENTS[value] || MANAGED_ACCENTS.forest;
  }

  function safeUrl(value, allowedProtocols = ["http:", "https:"]) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed, location.href);
      if (!allowedProtocols.includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function formatAnnouncementDate(value) {
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function createTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function openManagedAnnouncement(item) {
    const dialog = document.createElement("div");
    dialog.className = "announcement-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const panel = document.createElement("article");
    panel.className = "announcement-dialog-panel";
    panel.style.setProperty("--managed-accent", managedAccent(item.accent));

    const imageUrl = safeUrl(item.image);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title;
      panel.append(image);
    }

    panel.append(
      createTextElement("p", "eyebrow", (item.category || "Announcement") + " - " + formatAnnouncementDate(item.date)),
      createTextElement("h2", "", item.title)
    );

    if (item.summary) panel.append(createTextElement("p", "lead", item.summary));
    String(item.body || "").split(/\n{2,}|\n/).filter(Boolean).forEach((line) => {
      panel.append(createTextElement("p", "", line.trim()));
    });

    const actions = document.createElement("div");
    actions.className = "announcement-dialog-actions";

    const ctaUrl = safeUrl(item.ctaUrl, ["http:", "https:", "mailto:", "tel:"]);
    if (ctaUrl && item.ctaLabel) {
      const cta = document.createElement("a");
      cta.className = "button primary";
      cta.href = ctaUrl;
      cta.textContent = item.ctaLabel;
      actions.append(cta);
    }

    const close = document.createElement("button");
    close.className = "button ghost-dark announcement-dialog-close";
    close.type = "button";
    close.textContent = "Close";
    actions.append(close);
    panel.append(actions);
    dialog.append(panel);

    const closeDialog = () => {
      document.removeEventListener("keydown", onEscape);
      dialog.remove();
    };
    const onEscape = (event) => {
      if (event.key === "Escape") closeDialog();
    };

    close.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    document.addEventListener("keydown", onEscape);
    document.body.append(dialog);
    close.focus();
  }

  function createManagedCard(item) {
    const article = document.createElement("article");
    article.className = "story-card managed-story reveal is-visible";
    article.style.setProperty("--managed-accent", managedAccent(item.accent));
    if (item.featured) article.classList.add("is-featured");

    const media = document.createElement("button");
    media.className = "story-media managed-open";
    media.type = "button";
    media.dataset.managedOpen = item.id;
    const imageUrl = safeUrl(item.image);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title;
      image.loading = "lazy";
      media.append(image);
    } else {
      media.textContent = "NWCC";
    }

    const content = document.createElement("div");
    content.className = "story-content";
    if (item.featured) content.append(createTextElement("span", "managed-badge", "Featured"));
    content.append(
      createTextElement("p", "eyebrow", (item.category || "Announcement") + " - " + formatAnnouncementDate(item.date)),
      createTextElement("h2", "", item.title),
      createTextElement("p", "", item.summary || "")
    );

    const open = document.createElement("button");
    open.className = "text-link managed-open";
    open.type = "button";
    open.dataset.managedOpen = item.id;
    open.textContent = "Read announcement";
    content.append(open);

    article.append(media, content);
    return article;
  }

  function renderManagedAnnouncements() {
    const items = loadManagedAnnouncements();
    document.querySelectorAll("[data-managed-announcements]").forEach((container) => {
      const limit = Number(container.dataset.managedLimit || items.length);
      const visibleItems = items.slice(0, limit || items.length);
      container.replaceChildren();
      container.hidden = visibleItems.length === 0;
      visibleItems.forEach((item) => container.append(createManagedCard(item)));
      applyPremiumCardTilt(container);
    });
  }

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-managed-open]");
    if (!opener) return;
    const item = loadManagedAnnouncements().find((entry) => entry.id === opener.dataset.managedOpen);
    if (item) openManagedAnnouncement(item);
  });

  function renderAdminList() {
    const list = document.querySelector("[data-admin-announcement-list]");
    if (!list) return;
    const items = loadManagedAnnouncements();
    list.replaceChildren();

    if (!items.length) {
      list.append(createTextElement("p", "", "No admin announcements have been published in this browser."));
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "admin-list-item";
      const copy = document.createElement("div");
      const meta = document.createElement("div");
      meta.className = "admin-list-meta";
      meta.append(createTextElement("span", "admin-list-chip", item.category || "Announcement"));
      meta.append(createTextElement("span", "admin-list-chip", formatAnnouncementDate(item.date)));
      if (item.featured) meta.append(createTextElement("span", "admin-list-chip", "Featured"));
      copy.append(
        meta,
        createTextElement("h3", "", item.title),
        createTextElement("p", "", item.summary || "")
      );
      const remove = document.createElement("button");
      remove.className = "admin-delete";
      remove.type = "button";
      remove.dataset.adminDelete = item.id;
      remove.textContent = "Delete";
      row.append(copy, remove);
      list.append(row);
    });
  }

  function collectComposeData(form) {
    const data = new FormData(form);
    return {
      id: "__preview__",
      title: String(data.get("title") || "").trim(),
      date: String(data.get("date") || "").trim(),
      category: String(data.get("category") || "").trim(),
      accent: String(data.get("accent") || "forest").trim(),
      summary: String(data.get("summary") || "").trim(),
      body: String(data.get("body") || "").trim(),
      image: safeUrl(data.get("image")),
      ctaLabel: String(data.get("ctaLabel") || "").trim(),
      ctaUrl: safeUrl(data.get("ctaUrl"), ["http:", "https:", "mailto:", "tel:"]),
      featured: data.get("featured") === "on",
      createdAt: new Date().toISOString(),
    };
  }

  function previewItem(item) {
    return {
      ...item,
      title: item.title || "Announcement title",
      date: item.date || new Date().toISOString().slice(0, 10),
      category: item.category || "Announcement",
      summary: item.summary || "A short summary will appear here so families can quickly scan the update.",
      body: item.body || "Write the full announcement body here. Line breaks become clean paragraphs in the final announcement.",
    };
  }

  function renderAdminPreview(form) {
    const cardTarget = document.querySelector("[data-admin-card-preview]");
    const fullTarget = document.querySelector("[data-admin-full-preview]");
    if (!cardTarget || !fullTarget || !form) return;

    const item = previewItem(collectComposeData(form));
    cardTarget.replaceChildren();
    const card = createManagedCard(item);
    card.querySelectorAll("[data-managed-open]").forEach((control) => {
      control.removeAttribute("data-managed-open");
      control.setAttribute("aria-disabled", "true");
      if ("disabled" in control) control.disabled = true;
    });
    cardTarget.append(card);
    applyPremiumCardTilt(cardTarget);

    fullTarget.style.setProperty("--managed-accent", managedAccent(item.accent));
    fullTarget.replaceChildren();

    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.title;
      fullTarget.append(image);
    }

    fullTarget.append(
      createTextElement("p", "eyebrow", item.category + " - " + formatAnnouncementDate(item.date)),
      createTextElement("h2", "", item.title),
      createTextElement("p", "lead", item.summary)
    );

    item.body.split(/\n{2,}|\n/).filter(Boolean).slice(0, 4).forEach((line) => {
      fullTarget.append(createTextElement("p", "", line.trim()));
    });

    if (item.ctaLabel && item.ctaUrl) {
      const cta = document.createElement("a");
      cta.className = "button primary";
      cta.href = item.ctaUrl;
      cta.textContent = item.ctaLabel;
      fullTarget.append(cta);
    }
  }

  function showAdminEditor() {
    document.querySelector("[data-admin-login-panel]")?.setAttribute("hidden", "");
    document.querySelector("[data-admin-editor]")?.removeAttribute("hidden");
    renderAdminList();
  }

  function initAdminPage() {
    const loginForm = document.querySelector("[data-admin-login]");
    const composeForm = document.querySelector("[data-admin-compose]");
    if (!loginForm && !composeForm) return;

    const dateInput = composeForm?.querySelector('input[name="date"]');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    if (composeForm) {
      renderAdminPreview(composeForm);
      composeForm.addEventListener("input", () => renderAdminPreview(composeForm));
      composeForm.addEventListener("reset", () => {
        window.setTimeout(() => {
          if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
          renderAdminPreview(composeForm);
        }, 0);
      });
    }

    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") showAdminEditor();

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(loginForm);
      const message = document.querySelector("[data-admin-login-message]");
      const lockUntil = Number(sessionStorage.getItem(ADMIN_LOCK_KEY) || 0);
      if (lockUntil > Date.now()) {
        const seconds = Math.ceil((lockUntil - Date.now()) / 1000);
        if (message) message.textContent = "Too many attempts. Try again in " + seconds + " seconds.";
        return;
      }
      const passwordHash = crypto.subtle ? await sha256(String(data.get("password") || "")) : "";
      if (data.get("username") === ADMIN_USERNAME && passwordHash === ADMIN_PASSWORD_HASH) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
        sessionStorage.removeItem(ADMIN_ATTEMPTS_KEY);
        sessionStorage.removeItem(ADMIN_LOCK_KEY);
        loginForm.reset();
        showAdminEditor();
        return;
      }
      const attempts = Number(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || 0) + 1;
      sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, String(attempts));
      if (attempts >= 5) {
        sessionStorage.setItem(ADMIN_LOCK_KEY, String(Date.now() + 5 * 60 * 1000));
        sessionStorage.removeItem(ADMIN_ATTEMPTS_KEY);
        if (message) message.textContent = "Too many attempts. Try again in 5 minutes.";
        return;
      }
      if (message) message.textContent = "The username or password is incorrect. Attempts left: " + (5 - attempts) + ".";
    });

    document.querySelector("[data-admin-logout]")?.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      document.querySelector("[data-admin-editor]")?.setAttribute("hidden", "");
      document.querySelector("[data-admin-login-panel]")?.removeAttribute("hidden");
    });

    composeForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = { ...collectComposeData(composeForm), id: String(Date.now()) };

      if (!item.title || !item.date || !item.summary || !item.body) return;
      saveManagedAnnouncements([item, ...loadManagedAnnouncements()]);
      composeForm.reset();
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      const message = document.querySelector("[data-admin-compose-message]");
      if (message) message.textContent = "Announcement published in this browser.";
      renderAdminList();
      renderManagedAnnouncements();
      renderAdminPreview(composeForm);
    });

    document.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-admin-delete]");
      if (!remove) return;
      saveManagedAnnouncements(loadManagedAnnouncements().filter((item) => item.id !== remove.dataset.adminDelete));
      renderAdminList();
      renderManagedAnnouncements();
    });
  }

  renderManagedAnnouncements();
  initAdminPage();

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
