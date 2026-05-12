document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const navDropdownGroup = document.querySelector(".nav-dropdown-group");
  const navDropdownToggle = document.querySelector(".nav-dropdown-toggle");
  const supportsHoverDropdown = window.matchMedia("(hover: hover) and (pointer: fine)");
  let navDropdownCloseTimer;
  function setNavDropdownOpen(open) {
    window.clearTimeout(navDropdownCloseTimer);
    navDropdownGroup?.classList.toggle("is-open", open);
    navDropdownToggle?.setAttribute("aria-expanded", String(open));
  }
  function closeNavDropdownSoon() {
    window.clearTimeout(navDropdownCloseTimer);
    navDropdownCloseTimer = window.setTimeout(() => setNavDropdownOpen(false), 120);
  }
  navDropdownGroup?.addEventListener("pointerenter", () => {
    if (supportsHoverDropdown.matches) setNavDropdownOpen(true);
  });
  navDropdownGroup?.addEventListener("pointerleave", () => {
    if (supportsHoverDropdown.matches) closeNavDropdownSoon();
  });
  navDropdownGroup?.addEventListener("focusin", () => setNavDropdownOpen(true));
  navDropdownGroup?.addEventListener("focusout", (event) => {
    if (!event.relatedTarget?.closest?.(".nav-dropdown-group")) setNavDropdownOpen(false);
  });
  navDropdownToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (supportsHoverDropdown.matches) {
      setNavDropdownOpen(true);
      return;
    }
    setNavDropdownOpen(!navDropdownGroup?.classList.contains("is-open"));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-dropdown-group")) setNavDropdownOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNavDropdownOpen(false);
  });
  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setNavDropdownOpen(false);
      nav.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    });
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

  function enableImageZoom(root = document) {
    root.querySelectorAll(zoomSelector).forEach((img) => {
      if (img.dataset.zoomBound === "true") return;
      if (img.closest(".brand") || img.classList.contains("hero-bg")) return;
      img.dataset.zoomBound = "true";
      img.classList.add("zoomable-image");
      const zoomButton = img.closest(".gallery-tile");

      if (!img.closest("a, button")) {
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", "View larger image");
      }

      if (zoomButton && zoomButton.dataset.zoomBound !== "true") {
        zoomButton.dataset.zoomBound = "true";
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
  }

  enableImageZoom();

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

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
  }

  function parseImageList(value) {
    const list = Array.isArray(value) ? value : String(value || "").split(/\n+/);
    return list.map((entry) => safeUrl(entry)).filter(Boolean).slice(0, 12);
  }

  function normalizeManagedAnnouncement(item) {
    const title = String(item?.title || "").trim();
    const date = String(item?.date || "").trim();
    const fallbackId = slugify([title, date].filter(Boolean).join("-")) || String(item?.id || Date.now());
    const id = String(item?.id || item?.slug || fallbackId).trim();
    return {
      id,
      slug: slugify(item?.slug || id),
      title,
      date,
      status: item?.status === "draft" ? "draft" : "published",
      category: String(item?.category || "Announcement").trim(),
      accent: MANAGED_ACCENTS[item?.accent] ? item.accent : "forest",
      summary: String(item?.summary || "").trim(),
      body: String(item?.body || "").trim(),
      image: safeUrl(item?.image),
      gallery: parseImageList(item?.gallery),
      ctaLabel: String(item?.ctaLabel || "").trim(),
      ctaUrl: safeUrl(item?.ctaUrl, ["http:", "https:", "mailto:", "tel:"]),
      featured: Boolean(item?.featured),
      createdAt: String(item?.createdAt || new Date().toISOString()),
      updatedAt: String(item?.updatedAt || item?.createdAt || new Date().toISOString()),
    };
  }

  function sortManagedAnnouncements(a, b) {
    const dateRank = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateRank) return dateRank;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }

  function loadManagedAnnouncements(options = {}) {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "[]")
        .map(normalizeManagedAnnouncement)
        .filter((item) => item.title && item.date)
        .filter((item) => options.includeDrafts || item.status === "published")
        .sort(sortManagedAnnouncements);
    } catch {
      return [];
    }
  }

  function saveManagedAnnouncements(items) {
    const safeItems = items
      .map(normalizeManagedAnnouncement)
      .filter((item) => item.title && item.date)
      .sort(sortManagedAnnouncements);
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(safeItems));
  }

  function managedDetailUrl(item, rootRelative = false) {
    const id = encodeURIComponent(item.id || item.slug || "");
    const base = rootRelative || !location.pathname.includes("/announcements/")
      ? "announcements/admin-announcement.html"
      : "admin-announcement.html";
    return base + "?id=" + id;
  }

  function appendAnnouncementBody(target, body, limit) {
    const blocks = String(body || "")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const visibleBlocks = Number.isFinite(limit) ? blocks.slice(0, limit) : blocks;

    visibleBlocks.forEach((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      const heading = lines[0]?.match(/^(#{2,4})\s+(.+)/);
      if (heading) {
        const level = Math.min(4, Math.max(2, heading[1].length));
        target.append(createTextElement("h" + level, "", heading[2].trim()));
        lines.slice(1).forEach((line) => {
          target.append(createTextElement("p", "", line));
        });
        return;
      }
      lines.forEach((line) => {
        target.append(createTextElement("p", "", line));
      });
    });
  }

  function createManagedCard(item) {
    const article = document.createElement("article");
    article.className = "story-card managed-story reveal is-visible";
    article.dataset.announcementId = item.id;
    article.style.setProperty("--managed-accent", managedAccent(item.accent));
    if (item.featured) article.classList.add("is-featured");

    const media = document.createElement("a");
    media.className = "story-media managed-open";
    media.href = managedDetailUrl(item);
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
    if (item.status === "draft") content.append(createTextElement("span", "managed-badge managed-badge-muted", "Draft"));
    const title = document.createElement("h2");
    const titleLink = document.createElement("a");
    titleLink.href = managedDetailUrl(item);
    titleLink.textContent = item.title;
    title.append(titleLink);
    content.append(
      createTextElement("p", "eyebrow", (item.category || "Announcement") + " - " + formatAnnouncementDate(item.date)),
      title,
      createTextElement("p", "", item.summary || "")
    );

    const open = document.createElement("a");
    open.className = "text-link managed-open";
    open.href = managedDetailUrl(item);
    open.textContent = "Read announcement";
    content.append(open);

    article.append(media, content);
    return article;
  }

  function syncStaticAnnouncementCards(container, visibleManagedCount, limit) {
    if (!limit) return;
    const staticGrid = container.closest(".section")?.querySelector("[data-static-announcements]");
    if (!staticGrid) return;
    const remainingStatic = Math.max(limit - visibleManagedCount, 0);
    const staticCards = [...staticGrid.querySelectorAll(".story-card")];
    staticCards.forEach((card, index) => {
      card.hidden = index >= remainingStatic;
    });
    staticGrid.hidden = remainingStatic === 0;
  }

  function renderManagedAnnouncements() {
    const items = loadManagedAnnouncements();
    document.querySelectorAll("[data-managed-announcements]").forEach((container) => {
      const limit = Number(container.dataset.managedLimit || items.length);
      const visibleItems = items.slice(0, limit || items.length);
      container.replaceChildren();
      container.hidden = visibleItems.length === 0;
      visibleItems.forEach((item) => container.append(createManagedCard(item)));
      syncStaticAnnouncementCards(container, visibleItems.length, Number(container.dataset.managedLimit || 0));
      applyPremiumCardTilt(container);
    });
  }

  function renderManagedAnnouncementDetailPage() {
    const detail = document.querySelector("[data-managed-announcement-detail]");
    const hero = document.querySelector("[data-managed-announcement-hero]");
    if (!detail || !hero) return;

    const id = new URLSearchParams(location.search).get("id") || decodeURIComponent(location.hash.replace(/^#/, ""));
    const item = loadManagedAnnouncements().find((entry) => entry.id === id || entry.slug === id);

    hero.replaceChildren();
    const back = document.createElement("a");
    back.className = "back-link";
    back.href = "../announcements.html";
    back.textContent = "Back";
    hero.append(back);

    if (!item) {
      document.title = "Announcement not found | NWCC";
      hero.append(
        createTextElement("p", "eyebrow", "Announcement"),
        createTextElement("h1", "", "Announcement not found"),
        createTextElement("p", "lead", "This announcement is not saved in this browser or has not been published.")
      );
      detail.replaceChildren();
      const copy = document.createElement("div");
      copy.className = "article-copy";
      copy.append(createTextElement("p", "", "Go back to the announcements page or sign in to the admin dashboard on this browser."));
      detail.append(copy);
      return;
    }

    document.title = item.title + " | NWCC";
    document.querySelector('meta[name="description"]')?.setAttribute("content", item.summary || "Northwest Collaborative Center announcement.");
    hero.style.setProperty("--managed-accent", managedAccent(item.accent));
    hero.append(
      createTextElement("p", "eyebrow", (item.category || "Announcement") + " - " + formatAnnouncementDate(item.date)),
      createTextElement("h1", "", item.title),
      createTextElement("p", "lead", item.summary || "")
    );

    detail.replaceChildren();
    if (item.image) {
      const image = document.createElement("img");
      image.className = "article-cover";
      image.src = item.image;
      image.alt = item.title;
      image.loading = "lazy";
      detail.append(image);
    }

    const copy = document.createElement("div");
    copy.className = "article-copy";
    appendAnnouncementBody(copy, item.body);
    const ctaUrl = safeUrl(item.ctaUrl, ["http:", "https:", "mailto:", "tel:"]);
    if (item.ctaLabel && ctaUrl) {
      const cta = document.createElement("a");
      cta.className = "button primary";
      cta.href = ctaUrl;
      cta.textContent = item.ctaLabel;
      copy.append(cta);
    }
    detail.append(copy);

    if (item.gallery.length) {
      const gallery = document.createElement("div");
      gallery.className = "media-grid";
      item.gallery.forEach((src, index) => {
        const image = document.createElement("img");
        image.src = src;
        image.alt = item.title + " image " + (index + 1);
        image.loading = "lazy";
        gallery.append(image);
      });
      detail.append(gallery);
    }

    enableImageZoom(detail);
  }

  function renderAdminList() {
    const list = document.querySelector("[data-admin-announcement-list]");
    if (!list) return;
    const items = loadManagedAnnouncements({ includeDrafts: true });
    list.replaceChildren();

    if (!items.length) {
      list.append(createTextElement("p", "admin-empty", "No announcements have been saved in this browser."));
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
      if (item.status === "draft") meta.append(createTextElement("span", "admin-list-chip admin-list-chip-muted", "Draft"));
      copy.append(
        meta,
        createTextElement("h3", "", item.title),
        createTextElement("p", "", item.summary || "")
      );
      const actions = document.createElement("div");
      actions.className = "admin-list-actions";
      const edit = document.createElement("button");
      edit.className = "admin-list-button";
      edit.type = "button";
      edit.dataset.adminEdit = item.id;
      edit.textContent = "Edit";
      actions.append(edit);
      if (item.status === "published") {
        const view = document.createElement("a");
        view.className = "admin-list-button";
        view.href = managedDetailUrl(item, true);
        view.target = "_blank";
        view.rel = "noopener";
        view.textContent = "View";
        actions.append(view);
      }
      const remove = document.createElement("button");
      remove.className = "admin-list-button admin-delete";
      remove.type = "button";
      remove.dataset.adminDelete = item.id;
      remove.textContent = "Delete";
      actions.append(remove);
      row.append(copy, actions);
      list.append(row);
    });
  }

  function renderAdminMetrics() {
    const target = document.querySelector("[data-admin-metrics]");
    if (!target) return;
    const items = loadManagedAnnouncements({ includeDrafts: true });
    const published = items.filter((item) => item.status === "published");
    const drafts = items.filter((item) => item.status === "draft");
    const latest = published[0]?.date ? formatAnnouncementDate(published[0].date) : "None";
    target.replaceChildren();
    [
      ["Published", String(published.length)],
      ["Drafts", String(drafts.length)],
      ["Featured", String(items.filter((item) => item.featured).length)],
      ["Latest", latest],
    ].forEach(([label, value]) => {
      const card = document.createElement("article");
      card.className = "admin-metric";
      card.append(createTextElement("span", "", value), createTextElement("small", "", label));
      target.append(card);
    });
  }

  function collectComposeData(form) {
    const data = new FormData(form);
    const originalId = String(data.get("originalId") || "").trim();
    const slug = slugify(data.get("slug"));
    return {
      originalId,
      id: originalId || slug || "__preview__",
      slug,
      title: String(data.get("title") || "").trim(),
      date: String(data.get("date") || "").trim(),
      status: data.get("status") === "draft" ? "draft" : "published",
      category: String(data.get("category") || "").trim(),
      accent: String(data.get("accent") || "forest").trim(),
      summary: String(data.get("summary") || "").trim(),
      body: String(data.get("body") || "").trim(),
      image: safeUrl(data.get("image")),
      gallery: parseImageList(data.get("gallery")),
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
      id: item.slug || item.originalId || slugify([item.title, item.date].filter(Boolean).join("-")) || "__preview__",
    };
  }

  function renderAdminPreview(form) {
    const cardTarget = document.querySelector("[data-admin-card-preview]");
    const fullTarget = document.querySelector("[data-admin-full-preview]");
    if (!cardTarget || !fullTarget || !form) return;

    const item = previewItem(collectComposeData(form));
    cardTarget.replaceChildren();
    const card = createManagedCard(item);
    card.querySelectorAll("a").forEach((control) => {
      control.removeAttribute("href");
      control.setAttribute("aria-disabled", "true");
    });
    cardTarget.append(card);
    applyPremiumCardTilt(cardTarget);

    fullTarget.style.setProperty("--managed-accent", managedAccent(item.accent));
    fullTarget.replaceChildren();
    const pageChrome = document.createElement("div");
    pageChrome.className = "admin-page-preview-chrome";
    pageChrome.textContent = item.status === "draft" ? "Draft page preview" : managedDetailUrl(item, true);
    fullTarget.append(pageChrome);

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

    appendAnnouncementBody(fullTarget, item.body, 5);

    if (item.ctaLabel && item.ctaUrl) {
      const cta = document.createElement("a");
      cta.className = "button primary";
      cta.href = item.ctaUrl;
      cta.textContent = item.ctaLabel;
      fullTarget.append(cta);
    }

    const detailLink = document.querySelector("[data-admin-detail-link]");
    if (detailLink) {
      const canOpen = Boolean(item.originalId && item.status === "published");
      detailLink.href = canOpen ? managedDetailUrl({ ...item, id: item.originalId }, true) : "#";
      detailLink.toggleAttribute("aria-disabled", !canOpen);
    }
  }

  function uniqueManagedId(item, existingItems, originalId) {
    const base = item.slug || slugify([item.title, item.date].filter(Boolean).join("-")) || "announcement";
    let id = base;
    let count = 2;
    while (existingItems.some((entry) => entry.id === id && entry.id !== originalId)) {
      id = base + "-" + count;
      count += 1;
    }
    return id;
  }

  function setFormValue(form, name, value) {
    const field = form.elements[name];
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value || "";
  }

  function setAdminFormMode(form, editing) {
    document.querySelector("[data-admin-compose-title]").textContent = editing ? "Edit announcement" : "Create announcement";
    document.querySelector("[data-admin-submit]").textContent = editing ? "Update announcement" : "Publish announcement";
  }

  function resetAdminCompose(form, resetFields = true) {
    if (!form) return;
    if (resetFields) form.reset();
    setFormValue(form, "originalId", "");
    setFormValue(form, "slug", "");
    setFormValue(form, "date", new Date().toISOString().slice(0, 10));
    setFormValue(form, "status", "published");
    setFormValue(form, "accent", "forest");
    setAdminFormMode(form, false);
    const message = document.querySelector("[data-admin-compose-message]");
    if (message) message.textContent = "";
    renderAdminPreview(form);
  }

  function populateAdminForm(form, item) {
    setFormValue(form, "originalId", item.id);
    setFormValue(form, "title", item.title);
    setFormValue(form, "slug", item.slug || item.id);
    setFormValue(form, "date", item.date);
    setFormValue(form, "status", item.status);
    setFormValue(form, "category", item.category);
    setFormValue(form, "accent", item.accent);
    setFormValue(form, "summary", item.summary);
    setFormValue(form, "body", item.body);
    setFormValue(form, "image", item.image);
    setFormValue(form, "gallery", item.gallery.join("\n"));
    setFormValue(form, "ctaLabel", item.ctaLabel);
    setFormValue(form, "ctaUrl", item.ctaUrl);
    setFormValue(form, "featured", item.featured);
    setAdminFormMode(form, true);
    renderAdminPreview(form);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showAdminEditor() {
    document.querySelector("[data-admin-login-panel]")?.setAttribute("hidden", "");
    document.querySelector("[data-admin-editor]")?.removeAttribute("hidden");
    renderAdminMetrics();
    renderAdminList();
  }

  function initAdminPage() {
    const loginForm = document.querySelector("[data-admin-login]");
    const composeForm = document.querySelector("[data-admin-compose]");
    if (!loginForm && !composeForm) return;

    const dateInput = composeForm?.querySelector('input[name="date"]');
    if (composeForm) {
      resetAdminCompose(composeForm);
      renderAdminPreview(composeForm);
      composeForm.addEventListener("input", () => renderAdminPreview(composeForm));
      composeForm.addEventListener("reset", () => {
        window.setTimeout(() => {
          resetAdminCompose(composeForm, false);
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
      const data = collectComposeData(composeForm);
      const existingItems = loadManagedAnnouncements({ includeDrafts: true });
      const originalId = data.originalId;
      const existing = existingItems.find((item) => item.id === originalId);
      const id = uniqueManagedId(data, existingItems, originalId);
      const item = {
        ...data,
        id,
        slug: id,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete item.originalId;

      if (!item.title || !item.date || !item.summary || !item.body) return;
      saveManagedAnnouncements([item, ...existingItems.filter((entry) => entry.id !== originalId && entry.id !== id)]);
      resetAdminCompose(composeForm);
      const message = document.querySelector("[data-admin-compose-message]");
      if (message) message.textContent = item.status === "draft" ? "Draft saved in this browser." : "Announcement page published in this browser.";
      renderAdminMetrics();
      renderAdminList();
      renderManagedAnnouncements();
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-admin-new]")) {
        resetAdminCompose(composeForm);
        return;
      }

      const edit = event.target.closest("[data-admin-edit]");
      if (edit) {
        const item = loadManagedAnnouncements({ includeDrafts: true }).find((entry) => entry.id === edit.dataset.adminEdit);
        if (item && composeForm) populateAdminForm(composeForm, item);
        return;
      }

      const remove = event.target.closest("[data-admin-delete]");
      if (remove) {
        if (!window.confirm("Delete this announcement from this browser?")) return;
        saveManagedAnnouncements(loadManagedAnnouncements({ includeDrafts: true }).filter((item) => item.id !== remove.dataset.adminDelete));
        renderAdminMetrics();
        renderAdminList();
        renderManagedAnnouncements();
        return;
      }

      if (event.target.closest("[data-admin-export]")) {
        const json = document.querySelector("[data-admin-json]");
        const message = document.querySelector("[data-admin-data-message]");
        if (json) json.value = JSON.stringify(loadManagedAnnouncements({ includeDrafts: true }), null, 2);
        if (message) message.textContent = "Export ready.";
        return;
      }

      if (event.target.closest("[data-admin-import]")) {
        const json = document.querySelector("[data-admin-json]");
        const message = document.querySelector("[data-admin-data-message]");
        try {
          const parsed = JSON.parse(json?.value || "[]");
          if (!Array.isArray(parsed)) throw new Error("Expected an array");
          saveManagedAnnouncements(parsed);
          renderAdminMetrics();
          renderAdminList();
          renderManagedAnnouncements();
          if (message) message.textContent = "Imported announcements into this browser.";
        } catch {
          if (message) message.textContent = "Import failed. Paste valid exported JSON.";
        }
      }
    });
  }

  renderManagedAnnouncements();
  renderManagedAnnouncementDetailPage();
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
