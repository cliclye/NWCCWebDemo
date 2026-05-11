import fs from "node:fs";
import path from "node:path";

const root = path.resolve("www.northwest-cc.org");
const scrape = JSON.parse(fs.readFileSync("tools/nwcc-scrape.json", "utf8"));
const pages = new Map(scrape.pages.map((page) => [page.rel, page]));

const nav = [
  ["Home", "index.html"],
  ["Announcements", "announcements.html"],
  ["About", "about-us.html"],
  ["Performances", "projects.html"],
  ["Gallery", "gallery.html"],
  ["Contact", "contact-us.html"],
];

const secondaryNav = [
  ["Registration", "registration.html"],
  ["Donation", "donation.html"],
  ["Team", "teammembers.html"],
  ["Board", "team-3.html"],
];

const commonLines = new Set([
  "NorthWest Collaborative Center",
  "Home",
  "Announcements",
  "About Us",
  "Performances",
  "Gallery",
  "Contact Us",
  "Annoucements",
  "© Copyright 2023. NorthWest Collaborative Center, a not-for-profit, section 501(c)(3).",
  "Previous",
  "Next",
  "< Back",
  "< Back to Announcement List",
]);

const logo = pages.get("index.html").imgs.find((img) => img.alt === "NWCC Logo")?.src;
const heroImage =
  largestImage("index.html", (img) => img.src.includes("d6d5ff_00661")) ||
  largestImage("index.html", (img) => !isLogo(img));
const aboutImage = pages.get("about-us.html").imgs.find((img) => !img.alt.includes("Logo"))?.src;
const zelleImage = pages.get("donation.html").imgs.find((img) => !img.alt.includes("Logo"))?.src;
const registrationImage = pages.get("registration.html").imgs.find((img) => !img.alt.includes("Logo"))?.src;
const announcementThumb = pages.get("announcements.html").imgs.find((img) => !img.alt.includes("Logo"))?.src;

function prefixFor(rel) {
  const depth = rel.split("/").length - 1;
  return depth ? "../".repeat(depth) : "";
}

function hrefFor(fromRel, target) {
  if (/^https?:|^mailto:|^tel:/.test(target)) return target;
  return prefixFor(fromRel) + target;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cleanLines(rel) {
  const page = pages.get(rel);
  if (!page) return [];
  return page.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !commonLines.has(line));
}

function isLogo(img) {
  return /logo/i.test(img.alt) || /NWCC%20Logo/i.test(img.src);
}

function nonLogoImages(rel) {
  const seen = new Set();
  return (pages.get(rel)?.imgs || [])
    .filter((img) => !isLogo(img))
    .filter((img) => {
      const key = img.src.replace(/\/v1\/.*$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function imageArea(src = "") {
  const match = src.match(/w_(\d+),h_(\d+)/);
  return match ? Number(match[1]) * Number(match[2]) : 0;
}

function largestImage(rel, predicate) {
  return [...(pages.get(rel)?.imgs || [])]
    .filter(predicate)
    .sort((a, b) => imageArea(b.src) - imageArea(a.src))[0]?.src;
}

function meaningfulProjectImages(rel) {
  const placeholderPatterns = [/11062b_4b7c9/i, /placeholder/i, /Image-empty-state/i];
  const images = nonLogoImages(rel).filter((img) => !placeholderPatterns.some((pattern) => pattern.test(img.src)));
  return images.length ? images : nonLogoImages(rel);
}

function isHeading(line, index) {
  if (index === 0) return false;
  if (/^https?:\/\//.test(line)) return false;
  if (/@/.test(line)) return false;
  if (line.length > 78) return false;
  if (/^[[(]/.test(line)) return true;
  if (line.endsWith(":")) return true;
  if (/^[A-Z0-9 &–—'!-]+$/.test(line) && line.length > 8) return true;
  if (/^(Dear|Thank you|With gratitude,|Best regards,)$/.test(line)) return false;
  return !/[.!?]$/.test(line) && line.split(" ").length <= 8;
}

function renderRichLines(lines, options = {}) {
  const { startLevel = 2, compact = false } = options;
  return lines
    .filter(Boolean)
    .map((line, index) => {
      if (/^https?:\/\//.test(line)) {
        return `<p><a class="text-link" href="${esc(line)}">${esc(line)}</a></p>`;
      }
      if (isHeading(line, index)) {
        const level = Math.min(4, startLevel + (compact ? 1 : 0));
        return `<h${level}>${esc(line.replace(/^\[|\]$/g, ""))}</h${level}>`;
      }
      return `<p>${esc(line)}</p>`;
    })
    .join("\n");
}

function updatesSectionHtml(updateLines) {
  const fullInner = renderRichLines(updateLines.slice(1), { compact: true });
  return `
    <section class="section updates-section">
      <button type="button" class="updates-teaser reveal" id="updates-teaser-open" aria-expanded="false" aria-haspopup="dialog" aria-label="Open full important updates notice">
        <span class="updates-teaser-eyebrow eyebrow">Important updates</span>
        <strong class="updates-teaser-headline">Chamber Saturday schedule and new Korean language course</strong>
        <ul class="updates-teaser-list">
          <li><span class="updates-teaser-label">Practice</span> No group Feb&nbsp;14; Apr&nbsp;4 TBD by survey; no practice Apr&nbsp;11 (spring break).</li>
          <li><span class="updates-teaser-label">Korean</span> Small-group STAMP prep with certified instruction and Level&nbsp;4 TAs—additional proficiency levels welcome.</li>
        </ul>
        <span class="updates-teaser-cta">View full notice</span>
      </button>
      <template id="updates-full-template">
        <div class="updates-zoom-inner">
${fullInner}
        </div>
      </template>
    </section>`;
}

function articleBody(rel, title) {
  const lines = cleanLines(rel);
  const upperTitle = title.toUpperCase();
  return lines.filter((line) => line !== title && line !== upperTitle && !/^< Back/.test(line));
}

function dateFromDetail(rel) {
  const lines = cleanLines(rel);
  return lines.find((line) => /\d{4} at /.test(line)) || "";
}

function titleFromDetail(rel) {
  const lines = cleanLines(rel);
  const candidate = lines.find((line) => line === line.toUpperCase() && line.length > 4);
  if (candidate) return titleCase(candidate);
  return pages.get(rel).title.replace(/\s*\|\s*NWCC$/, "");
}

function titleCase(value) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace("Nwcc", "NWCC")
    .replace("Choir", "Choir")
    .replace("And", "and");
}

function firstParagraph(lines) {
  return lines.find((line) => line.length > 60 && !/\d{4} at /.test(line)) || lines.find((line) => line.length > 20) || "";
}

const announcementRels = [
  "announcements/january-2026-update.html",
  "announcements/december-2025-update.html",
  "announcements/nwcc-newsletter---november-2025.html",
  "announcements/join-nwcc-–-chamber-&-choir!-.html",
  "announcements/thank-you-&-final-nwcc-meeting-invitation.html",
  "announcements/nwcc-june-updates!.html",
  "announcements/the-final-concert!!!.html",
  "announcements/spring-updates!!!!.html",
  "announcements/nwcc-spring-updates-–-spring-break,-collaborative-concert-&-more.html",
];

const announcements = announcementRels.map((rel) => {
  const title = titleFromDetail(rel);
  const lines = articleBody(rel, title);
  const date = dateFromDetail(rel).replace(/ at .*/, "");
  const image = nonLogoImages(rel).find((img) => !img.src.includes("feb1f2_4e671"))?.src || announcementThumb;
  return { rel, title, date, summary: firstParagraph(lines), image };
});

const projectRels = [
  "projects/our-lady-of-fatima-performance---fall-2025.html",
  "projects/aegis-living-concert---fall-2025.html",
  "projects/summer-neighbor-concert.html",
  "projects/event-4-gallery.html",
];

const projects = projectRels.map((rel) => {
  const lines = cleanLines(rel).filter((line) => line !== "Project Gallery");
  const title = lines[0] || pages.get(rel).title.replace(/\s*\|\s*NWCC$/, "");
  const subtitle = lines[1] || "";
  const body = lines.slice(2).filter((line) => !["Project Gallery"].includes(line));
  const images = meaningfulProjectImages(rel);
  return { rel, title, subtitle, summary: firstParagraph(body), image: images[0]?.src, gallery: images.slice(1), body };
});

function activeClass(rel, target) {
  if (target === "index.html" && rel === "index.html") return " active";
  if (target !== "index.html" && (rel === target || rel.startsWith(target.replace(".html", "")))) return " active";
  if (target === "announcements.html" && rel.startsWith("announcements/")) return " active";
  if (target === "projects.html" && rel.startsWith("projects/")) return " active";
  return "";
}

function shell({ rel, title, description = "Northwest Collaborative Center brings music and education to all.", body, pageClass = "" }) {
  const prefix = prefixFor(rel);
  const navLinks = nav
    .map(([label, target]) => `<a class="nav-link${activeClass(rel, target)}" href="${hrefFor(rel, target)}">${label}</a>`)
    .join("");
  const secondaryLinks = secondaryNav
    .map(([label, target]) => `<a href="${hrefFor(rel, target)}">${label}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" sizes="192x192" href="${esc(logo)}" type="image/png">
  <link rel="stylesheet" href="${prefix}assets/app.css">
  <script defer src="${prefix}assets/app.js"></script>
</head>
<body class="${pageClass}">
  <header class="site-header">
    <a class="brand" href="${hrefFor(rel, "index.html")}" aria-label="NorthWest Collaborative Center home">
      <img src="${esc(logo)}" alt="NWCC logo">
      <span>NorthWest Collaborative Center</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
      ${navLinks}
    </nav>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <div>
      <a class="footer-brand" href="${hrefFor(rel, "index.html")}">NorthWest Collaborative Center</a>
      <p>Music and education for all through youth service, community performance, and collaborative learning.</p>
    </div>
    <div class="footer-links">
      ${secondaryLinks}
    </div>
    <p class="copyright">© Copyright 2023. NorthWest Collaborative Center, a not-for-profit, section 501(c)(3).</p>
  </footer>
</body>
</html>
`;
}

function stat(label, value) {
  return `<div class="stat"><span>${esc(value)}</span><small>${esc(label)}</small></div>`;
}

function imageCard(src, alt = "") {
  return `<figure class="image-card"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></figure>`;
}

function announcementCard(item, fromRel) {
  return `<article class="story-card reveal">
    <a class="story-media" href="${hrefFor(fromRel, item.rel)}"><img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy"></a>
    <div class="story-content">
      <p class="eyebrow">${esc(item.date || "Announcement")}</p>
      <h2><a href="${hrefFor(fromRel, item.rel)}">${esc(item.title)}</a></h2>
      <p>${esc(item.summary)}</p>
      <a class="text-link" href="${hrefFor(fromRel, item.rel)}">Read announcement</a>
    </div>
  </article>`;
}

function projectCard(project, fromRel) {
  return `<article class="project-card reveal">
    <a class="project-image" href="${hrefFor(fromRel, project.rel)}"><img src="${esc(project.image)}" alt="${esc(project.title)}" loading="lazy"></a>
    <div class="project-info">
      <p class="eyebrow">${esc(project.subtitle)}</p>
      <h2><a href="${hrefFor(fromRel, project.rel)}">${esc(project.title)}</a></h2>
      <p>${esc(project.summary)}</p>
      <a class="pill-link" href="${hrefFor(fromRel, project.rel)}">View gallery</a>
    </div>
  </article>`;
}

function write(rel, html) {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

function cleanAssetDirectory() {
  fs.mkdirSync(path.join(root, "assets"), { recursive: true });
  for (const file of ["nwcc-redesign.css", "nwcc-redesign.js"]) {
    const target = path.join(root, "assets", file);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

function buildHome() {
  const lines = cleanLines("index.html");
  const updateLines = lines.slice(lines.indexOf("Important  Updates:"), lines.indexOf("Music and Education for All.") + 1);
  const aboutLines = lines.slice(lines.indexOf("WHO ARE WE?"), lines.indexOf("About Us"));
  const body = `
    <section class="hero">
      <img class="hero-bg" src="${esc(heroImage)}" alt="NWCC chamber musicians" loading="eager">
      <div class="hero-shade"></div>
      <div class="hero-content reveal">
        <p class="eyebrow">Bellevue and Seattle area nonprofit</p>
        <h1>We Bring Music and Education to All</h1>
        <p>Young musicians, educators, and volunteers serving communities through concerts, lessons, and collaborative projects.</p>
        <div class="hero-actions">
          <a class="button primary" href="about-us.html">Learn More</a>
          <a class="button ghost" href="registration.html">Join NWCC</a>
        </div>
      </div>
      <div class="hero-stats">
        ${stat("Mission", "501(c)(3)")}
        ${stat("Practice", "Saturdays")}
        ${stat("Focus", "Music + Education")}
      </div>
    </section>
    ${updatesSectionHtml(updateLines)}
    <section class="section">
      <div class="section-heading">
        <p class="eyebrow">Announcements</p>
        <h2>Latest from NWCC</h2>
        <a class="text-link" href="announcements.html">View all announcements</a>
      </div>
      <div class="story-grid">${announcements.slice(0, 3).map((item) => announcementCard(item, "index.html")).join("")}</div>
    </section>
    <section class="section about-preview">
      <div class="about-copy reveal">
        ${renderRichLines(aboutLines)}
        <a class="button primary" href="about-us.html">About Us</a>
      </div>
      ${imageCard(aboutImage, "NWCC musicians rehearsing")}
    </section>
    <section class="cta-band reveal">
      <p class="eyebrow">Contact us</p>
      <h2>Want to get involved?</h2>
      <p>Reach out to the Northwest Collaborative Center about volunteering, lessons, performances, or community projects.</p>
      <a class="button primary" href="contact-us.html">Start Here</a>
    </section>`;
  write("index.html", shell({ rel: "index.html", title: "Northwest Collaborative Center", body, pageClass: "home-page" }));
}

function buildAbout() {
  const lines = cleanLines("about-us.html").filter((line) => !["Start Here"].includes(line));
  const titleIndex = lines.indexOf("About Us");
  const secondIndex = lines.indexOf("NWCC WORKS TO IMPROVE EDUCATIONAL EQUITY");
  const first = lines.slice(titleIndex + 1, secondIndex);
  const second = lines.slice(secondIndex);
  const body = `
    <section class="page-hero dark">
      <div class="page-copy reveal">
        <p class="eyebrow">Who we are</p>
        <h1>About Us</h1>
        ${renderRichLines(first)}
      </div>
      ${imageCard(aboutImage, "NWCC rehearsal")}
    </section>
    <section class="section article-flow">
      ${renderRichLines(second)}
      <div class="cta-inline">
        <a class="button primary" href="contact-us.html">Start Here</a>
        <a class="button ghost-dark" href="teammembers.html">Meet the Team</a>
      </div>
    </section>`;
  write("about-us.html", shell({ rel: "about-us.html", title: "About Us | Northwest Collaborative Center", body }));
}

function buildAnnouncements() {
  const body = `
    <section class="page-title">
      <p class="eyebrow">Updates and newsletters</p>
      <h1>Announcements</h1>
      <p>Recent program notes, practice updates, performance announcements, and newsletters from NWCC.</p>
    </section>
    <section class="section story-list">${announcements.map((item) => announcementCard(item, "announcements.html")).join("")}</section>`;
  write("announcements.html", shell({ rel: "announcements.html", title: "Announcements | NWCC", body }));

  for (const item of announcements) {
    const lines = articleBody(item.rel, item.title).filter((line) => line !== dateFromDetail(item.rel));
    const images = nonLogoImages(item.rel).filter((img) => img.src !== announcementThumb);
    const body = articlePage({
      rel: item.rel,
      back: "announcements.html",
      eyebrow: item.date || "Announcement",
      title: item.title,
      intro: item.summary,
      lines,
      images,
    });
    write(item.rel, shell({ rel: item.rel, title: `${item.title} | NWCC`, body, pageClass: "article-page" }));
  }
}

function articlePage({ rel, back, eyebrow, title, intro, lines, images }) {
  return `
    <section class="article-hero">
      <a class="back-link" href="${hrefFor(rel, back)}">Back</a>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${esc(title)}</h1>
      ${intro ? `<p class="lead">${esc(intro)}</p>` : ""}
    </section>
    <article class="article-body">
      ${images[0] ? `<img class="article-cover" src="${esc(images[0].src)}" alt="${esc(title)}" loading="lazy">` : ""}
      <div class="article-copy">${renderRichLines(lines)}</div>
      ${images.length > 1 ? `<div class="media-grid">${images.slice(1).map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt || title)}" loading="lazy">`).join("")}</div>` : ""}
    </article>`;
}

function buildProjects() {
  const body = `
    <section class="page-title">
      <p class="eyebrow">Community performance archive</p>
      <h1>Concerts and Performances</h1>
      <p>Browse NWCC community concerts, collaborations, service performances, and fundraising events.</p>
    </section>
    <section class="section project-list">${projects.map((project) => projectCard(project, "projects.html")).join("")}</section>`;
  write("projects.html", shell({ rel: "projects.html", title: "Concerts and Performances | NWCC", body }));

  for (const project of projects) {
    const body = `
      <section class="project-hero">
        <a class="back-link" href="${hrefFor(project.rel, "projects.html")}">Back</a>
        <div class="project-hero-grid">
          <div class="reveal">
            <p class="eyebrow">${esc(project.subtitle)}</p>
            <h1>${esc(project.title)}</h1>
            ${renderRichLines(project.body)}
          </div>
          ${imageCard(project.image, project.title)}
        </div>
      </section>
      <section class="section">
        <div class="section-heading">
          <p class="eyebrow">Project gallery</p>
          <h2>${esc(project.title)}</h2>
        </div>
        <div class="media-grid gallery-grid">${project.gallery.map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt || project.title)}" loading="lazy">`).join("")}</div>
      </section>`;
    write(project.rel, shell({ rel: project.rel, title: `${project.title} | NWCC`, body, pageClass: "project-detail-page" }));
  }
}

function buildGallery() {
  const im = nonLogoImages("gallery.html");
  const tile = (index, alt) => {
    const img = im[index];
    if (!img) return "";
    const label = alt || img.alt || "NWCC gallery photo";
    return `<button class="gallery-tile" type="button"><img src="${esc(img.src)}" alt="${esc(label)}" loading="lazy"></button>`;
  };

  const body = `
    <section class="page-title">
      <p class="eyebrow">Photos</p>
      <h1>Gallery</h1>
      <p>Chamber, teaching team, technology team, and volunteer moments from NWCC programs.</p>
    </section>
    <div class="gallery-shell">
      <section class="gallery-layout-block gallery-chamber-block" aria-labelledby="gallery-chamber-title">
        <h2 id="gallery-chamber-title" class="gallery-section-title">Chamber</h2>
        <div class="gallery-chamber-grid">
          ${tile(0, "Chamber ensemble rehearsal")}
          ${tile(1, "Chamber ensemble rehearsal")}
          ${tile(2, "Chamber ensemble rehearsal")}
          ${tile(3, "Chamber ensemble rehearsal")}
        </div>
        <div class="gallery-hero-wrap">
          ${tile(4, "Chamber group performance rehearsal")}
        </div>
        <div class="gallery-video-row">
          <div class="gallery-video-cell gallery-play-overlay">
            ${tile(5, "Chamber practice video still")}
            <span class="gallery-play-dot" aria-hidden="true"></span>
            <span class="gallery-play-triangle" aria-hidden="true"></span>
          </div>
          <div class="gallery-video-cell gallery-play-overlay">
            ${tile(6, "Chamber practice video still")}
            <span class="gallery-play-dot" aria-hidden="true"></span>
            <span class="gallery-play-triangle" aria-hidden="true"></span>
          </div>
        </div>
      </section>

      <section id="teaching-team" class="gallery-layout-block gallery-teaching-head" aria-labelledby="gallery-teaching-title">
        <h2 id="gallery-teaching-title" class="gallery-section-title">Teaching Team</h2>
        <nav class="gallery-team-tabs" aria-label="Teaching team subjects">
          <a class="gallery-tab is-active" href="#math-1">Math 1</a>
          <a class="gallery-tab" href="#math-2">Math 2</a>
          <a class="gallery-tab" href="#writing">Writing</a>
          <a class="gallery-tab" href="#spanish">Spanish</a>
          <a class="gallery-tab" href="#book-club">Book Club</a>
        </nav>
      </section>

      <section id="math-1" class="gallery-layout-block gallery-math1-block" aria-labelledby="gallery-math1-title">
        <h3 id="gallery-math1-title" class="gallery-subsection-title">Math 1</h3>
        <div class="gallery-math1-top">
          ${tile(7, "Math 1 tutoring session")}
          ${tile(8, "Math 1 tutoring session")}
        </div>
        <div class="gallery-math1-bottom">
          ${tile(9, "Math 1 group at tables")}
          ${tile(10, "Math 1 classroom")}
        </div>
        <p class="gallery-instructors">Volunteer Instructors: Eliana Lee, Ryan Pan</p>
      </section>

      <section id="math-2" class="gallery-layout-block gallery-math2-block" aria-labelledby="gallery-math2-title">
        <h3 id="gallery-math2-title" class="gallery-subsection-title">Math 2</h3>
        <div class="gallery-math2-row">
          ${tile(11, "Math 2 students at whiteboard")}
          ${tile(12, "Math 2 group work")}
        </div>
        <p class="gallery-instructors gallery-instructors-between">Volunteer Instructors: Christopher Chae, Tianyi Yang, Jun</p>
        <div class="gallery-math2-row">
          ${tile(13, "Math 2 classroom")}
          ${tile(14, "Math 2 whiteboard equations")}
        </div>
      </section>

      <section id="writing" class="gallery-layout-block gallery-writing-block" aria-labelledby="gallery-writing-title">
        <h3 id="gallery-writing-title" class="gallery-subsection-title">Writing</h3>
        <div class="gallery-writing-single">
          ${tile(15, "Writing program small group")}
        </div>
        <p class="gallery-instructors">Volunteer Instructors: Juhee Jang, Gracy Yoo, Angela Kim</p>
      </section>

      <section id="spanish" class="gallery-layout-block gallery-spanish-block" aria-labelledby="gallery-spanish-title">
        <h3 id="gallery-spanish-title" class="gallery-subsection-title">Spanish</h3>
        <div class="gallery-spanish-hero">
          ${tile(16, "Spanish class session")}
        </div>
        <div class="gallery-math2-row">
          ${tile(17, "Spanish study group")}
          ${tile(18, "Spanish class at whiteboard")}
        </div>
        <p class="gallery-instructors">Volunteer Instructors: Cheon-Hee Park, Luke, Andrew</p>
        <div class="gallery-spanish-wide">
          ${tile(19, "Spanish program classroom")}
        </div>
      </section>

      <section id="book-club" class="gallery-layout-block gallery-bookclub-block" aria-labelledby="gallery-bookclub-divider">
        <div class="gallery-bookclub-photo">
          ${tile(20, "Book club discussion")}
        </div>
        <h3 id="gallery-bookclub-divider" class="gallery-bookclub-divider">Book Club</h3>
        <div class="gallery-bookclub-photo">
          ${tile(21, "Book club at tables")}
        </div>
        <p class="gallery-instructors">Volunteer Instructors: Ashley Shim, Fiona Impert, Joy Yoo</p>
      </section>

      <section id="tech-team" class="gallery-layout-block gallery-tech-block" aria-labelledby="gallery-tech-title">
        <h2 id="gallery-tech-title" class="gallery-tech-title">Tech Team</h2>
        <p class="gallery-tech-members">Volunteer Team Members: Rachel Da, Nathan Da, Tianyi Yang, Wesley Jeong</p>
        <div class="gallery-tech-photo">
          ${tile(22, "Tech team collaborating with laptops")}
        </div>
      </section>
    </div>`;

  write("gallery.html", shell({ rel: "gallery.html", title: "Gallery | NWCC", body, pageClass: "gallery-page" }));
}

function buildContact() {
  const body = `
    <section class="page-title left">
      <p class="eyebrow">Contact</p>
      <h1>Contact Us</h1>
    </section>
    <section class="section contact-grid">
      <div class="contact-card reveal">
        <h2>Main Practice Location</h2>
        <p>14220 Juanita Woodinville Way NE<br>Kirkland, WA 98034</p>
        <h2>Office</h2>
        <p>741 15th Way SW<br>Edmonds, WA 98020</p>
        <h2>Web Contact</h2>
        <p><a class="text-link" href="mailto:Admin@northwest-cc.org">Admin@northwest-cc.org</a></p>
        <h2>Office Phone</h2>
        <p><a class="text-link" href="tel:+12063496421">(206) 349-6421</a></p>
      </div>
      <div class="map-card reveal">
        <span>Kirkland, Bellevue, Seattle</span>
      </div>
      <div class="contact-note">
        <p>We serve local communities in Bellevue and Seattle areas of Washington. If you wish to learn more about Northwest Collaborative Center, feel free to visit us or contact us.</p>
      </div>
      <form class="signup-card reveal" data-static-form>
        <h2>Get in Touch</h2>
        <p>Sign up for NWCC's mailing list</p>
        <label>
          <span>Email address</span>
          <input type="email" name="email" placeholder="youremail@email.com" required>
        </label>
        <button class="button primary" type="submit">Submit</button>
        <p class="form-message" role="status"></p>
      </form>
    </section>`;
  write("contact-us.html", shell({ rel: "contact-us.html", title: "Contact Us | Northwest Collaborative Center", body }));
}

function buildSimplePages() {
  write("registration.html", shell({
    rel: "registration.html",
    title: "Registration | NWCC",
    body: `
      <section class="simple-hero">
        <div>
          <p class="eyebrow">Registration</p>
          <h1>Registration Form</h1>
          <p>This year, Chamber and Choir registration are combined into one form.</p>
          <a class="button primary" href="https://forms.gle/5VMaoBipV2Zfk9Tr8">Click here to register</a>
          <p><a class="text-link" href="https://forms.gle/5VMaoBipV2Zfk9Tr8">https://forms.gle/5VMaoBipV2Zfk9Tr8</a></p>
        </div>
        ${registrationImage ? imageCard(registrationImage, "NWCC chamber and choir") : ""}
      </section>`,
  }));

  write("donation.html", shell({
    rel: "donation.html",
    title: "Donation | NWCC",
    body: `
      <section class="simple-hero">
        <div>
          <p class="eyebrow">Donation</p>
          <h1>Support NWCC</h1>
          <p>We accept donation through Zelle.</p>
          <p>Thank you for your generous donation!</p>
        </div>
        ${zelleImage ? imageCard(zelleImage, "NWCC Zelle donation information") : ""}
      </section>`,
  }));

  const teamLines = cleanLines("teammembers.html");
  const names = [
    ["Education Team", "Jeongwon Hyun", "Education Program Development"],
    ["Enrichment Team", "Ashley Sim", "Enrichment Lead"],
    ["Technology Team", "Tom Wang", "Website Developer"],
    ["Chamber Team", "YongWoon Chung", "Conductor"],
    ["Choir Team", "Sim", "Choir Instructor"],
  ];
  const teamImages = nonLogoImages("teammembers.html");
  write("teammembers.html", shell({
    rel: "teammembers.html",
    title: "Team | NWCC",
    body: `
      <section class="page-title">
        <p class="eyebrow">Teams</p>
        <h1>Dedication. Expertise. Passion.</h1>
      </section>
      <section class="section people-grid">${names.map((person, index) => `
        <article class="person-card reveal">
          ${teamImages[index] ? `<img src="${esc(teamImages[index].src)}" alt="${esc(person[1])}" loading="lazy">` : ""}
          <p class="eyebrow">${esc(person[0])}</p>
          <h2>${esc(person[1])}</h2>
          <p>${esc(person[2])}</p>
        </article>`).join("")}</section>`,
  }));

  const boardImages = nonLogoImages("team-3.html");
  write("team-3.html", shell({
    rel: "team-3.html",
    title: "Board of Directors | NWCC",
    body: `
      <section class="page-title">
        <p class="eyebrow">Leadership</p>
        <h1>Board of Directors</h1>
      </section>
      <section class="section people-grid">${boardImages.map((img, index) => `
        <article class="person-card reveal">
          <img src="${esc(img.src)}" alt="${esc(img.alt || `Board director ${index + 1}`)}" loading="lazy">
          <h2>Board Director</h2>
        </article>`).join("")}</section>`,
  }));

  for (const rel of ["about-4.html", "newsletter-nov-2025.html"]) {
    const page = pages.get(rel);
    const title = page.title.replace(/\s*\|\s*NWCC$/, "");
    const lines = cleanLines(rel).filter((line) => line !== title);
    const images = nonLogoImages(rel);
    write(rel, shell({
      rel,
      title: page.title,
      body: articlePage({ rel, back: rel === "about-4.html" ? "registration.html" : "announcements.html", eyebrow: "NWCC", title, intro: firstParagraph(lines), lines, images }),
      pageClass: "article-page",
    }));
  }
}

function writeAssets() {
  fs.writeFileSync(path.join(root, "assets", "app.css"), css);
  fs.writeFileSync(path.join(root, "assets", "app.js"), js);
}

const css = `:root {
  --ink: #13211f;
  --muted: #66736d;
  --paper: #f8f7f1;
  --surface: #ffffff;
  --mist: #e8f1ed;
  --forest: #0c6b55;
  --blue: #133f84;
  --gold: #d89c35;
  --coral: #d76c4b;
  --line: rgba(19, 33, 31, .12);
  --shadow: 0 24px 80px rgba(22, 34, 31, .16);
  --soft: 0 12px 38px rgba(22, 34, 31, .1);
  --ease-premium: cubic-bezier(.16, 1, .3, 1);
  --ease-press: cubic-bezier(.2, .8, .2, 1);
  --radius: 8px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--paper); }
body { margin: 0; color: var(--ink); background: var(--paper); font-family: inherit; font-size: 16px; line-height: 1.6; letter-spacing: 0; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
p { margin: 0 0 1rem; }
h1, h2, h3, h4 { line-height: 1.05; margin: 0 0 1rem; letter-spacing: 0; }
h1 { font-size: clamp(3rem, 8vw, 7.8rem); }
h2 { font-size: clamp(2rem, 4vw, 4rem); }
h3 { font-size: clamp(1.35rem, 2vw, 2rem); }
.site-header { position: sticky; top: 0; z-index: 50; min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 14px clamp(20px, 5vw, 72px); background: rgba(248, 247, 241, .88); border-bottom: 1px solid var(--line); backdrop-filter: blur(18px); }
.brand { display: inline-flex; align-items: center; gap: 14px; font-weight: 850; font-size: clamp(1rem, 2vw, 1.35rem); }
.brand img { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 6px; padding: 7px; box-shadow: var(--soft); }
.site-nav { display: flex; align-items: center; gap: 8px; font-size: .92rem; font-weight: 760; }
.nav-link { padding: 10px 13px; border-radius: 999px; color: rgba(19,33,31,.8); transition: background .28s var(--ease-premium), color .28s var(--ease-premium), transform .28s var(--ease-premium); }
.nav-link:hover, .nav-link.active { background: var(--mist); color: var(--ink); transform: translateY(-1px); }
.nav-toggle { display: none; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--ink); padding: 10px 14px; font: inherit; font-weight: 800; }
.hero { min-height: calc(100vh - 88px); position: relative; display: grid; align-items: end; overflow: hidden; color: #fff; background: #081b18; }
.hero-bg, .hero-shade { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-bg { object-fit: cover; animation: slowZoom 22s ease-in-out infinite alternate; }
.hero-shade { background: linear-gradient(90deg, rgba(8,24,21,.88), rgba(8,24,21,.56) 46%, rgba(8,24,21,.18)), linear-gradient(180deg, rgba(8,24,21,.14), rgba(8,24,21,.84)); }
.hero-content { position: relative; z-index: 2; width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: clamp(80px, 12vh, 150px) 0 90px; }
.hero-content p { max-width: 690px; color: rgba(255,255,255,.86); font-size: clamp(1.05rem, 2vw, 1.35rem); font-weight: 540; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 30px; }
.hero-stats { position: relative; z-index: 2; width: min(1120px, calc(100% - 40px)); margin: -56px auto 34px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: var(--radius); padding: 18px; backdrop-filter: blur(14px); }
.stat span { display: block; font-size: 1.5rem; font-weight: 850; }
.stat small { color: rgba(255,255,255,.72); text-transform: uppercase; font-weight: 800; font-size: .75rem; }
.eyebrow, .section-kicker { color: var(--gold); text-transform: uppercase; font-size: .82rem; font-weight: 900; letter-spacing: 0; }
.button, .pill-link { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 22px; border-radius: 999px; font-weight: 850; transition: transform .32s var(--ease-premium), box-shadow .32s var(--ease-premium), background .32s var(--ease-premium); }
.button.primary, .pill-link { background: var(--forest); color: #fff; box-shadow: 0 18px 44px rgba(12,107,85,.24); }
.button.ghost { border: 1px solid rgba(255,255,255,.42); color: #fff; background: rgba(255,255,255,.1); }
.button.ghost-dark { border: 1px solid var(--line); color: var(--ink); background: #fff; }
.button:hover, .pill-link:hover { transform: translateY(-2px); }
.button:active, .pill-link:active { transform: translateY(0) scale(.97); }
.section { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: clamp(70px, 10vw, 120px) 0; }
.split-section { display: grid; grid-template-columns: .42fr 1fr; gap: clamp(28px, 6vw, 80px); align-items: start; }
.updates-section { display: flex; justify-content: center; }
.updates-teaser { width: min(560px, 100%); margin: 0; padding: clamp(28px, 5vw, 48px); border: 0; border-radius: var(--radius); text-align: left; font: inherit; color: #fff; cursor: zoom-in; box-shadow: var(--shadow); background: linear-gradient(135deg, var(--blue), var(--forest)); transition: transform .32s var(--ease-premium), box-shadow .32s var(--ease-premium); }
.updates-teaser:hover { transform: translateY(-3px); box-shadow: 0 28px 90px rgba(19, 63, 132, .28); }
.updates-teaser:active { transform: translateY(-1px) scale(.992); }
.updates-teaser-eyebrow { display: block; margin-bottom: 12px; color: var(--gold); }
.updates-teaser-headline { display: block; font-size: clamp(1.2rem, 2.4vw, 1.55rem); font-weight: 850; line-height: 1.25; margin-bottom: 16px; color: #fff; }
.updates-teaser-list { margin: 0 0 18px; padding-left: 1.15rem; color: rgba(255, 255, 255, .9); font-size: .98rem; line-height: 1.5; }
.updates-teaser-list li { margin-bottom: 10px; }
.updates-teaser-list li:last-child { margin-bottom: 0; }
.updates-teaser-label { display: inline-block; min-width: 4.5rem; font-weight: 850; color: rgba(255, 255, 255, .98); }
.updates-teaser-cta { display: inline-flex; align-items: center; font-weight: 850; font-size: .95rem; color: var(--gold); text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(216, 156, 53, .45); }
.updates-zoom-clone { position: fixed; top: 0; left: 0; z-index: 101; max-width: none; overflow: hidden; cursor: default; box-sizing: border-box; background: #fff; color: var(--ink); box-shadow: 0 20px 52px rgba(0, 0, 0, .22); will-change: transform, width, height, border-radius, box-shadow; transition: transform .68s var(--ease-premium), width .68s var(--ease-premium), height .68s var(--ease-premium), border-radius .68s var(--ease-premium), box-shadow .68s var(--ease-premium); }
.updates-zoom-clone.is-open { box-shadow: 0 32px 120px rgba(0, 0, 0, .42); }
.updates-zoom-scroll { max-height: 100%; overflow: auto; padding: clamp(22px, 4vw, 40px); padding-top: clamp(40px, 5vw, 52px); -webkit-overflow-scrolling: touch; }
.updates-zoom-inner h3 { color: var(--forest); margin-top: 1.5rem; font-size: clamp(1.1rem, 1.8vw, 1.45rem); }
.updates-zoom-inner p:last-child { margin-bottom: 0; }
.updates-zoom-close { position: absolute; top: 12px; right: 12px; z-index: 2; min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink); font: inherit; font-weight: 800; cursor: pointer; transition: background .25s var(--ease-premium), border-color .25s var(--ease-premium); }
.updates-zoom-close:hover { background: var(--mist); border-color: rgba(12, 107, 85, .28); }
.feature-panel, .contact-card, .signup-card, .compact-info { background: #fff; border: 1px solid var(--line); border-top: 5px solid var(--gold); border-radius: var(--radius); box-shadow: var(--soft); padding: clamp(26px, 4vw, 52px); }
.feature-panel h3, .article-copy h2, .compact-info h3 { color: var(--forest); margin-top: 2rem; font-size: clamp(1.2rem, 2vw, 1.6rem); }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 30px; }
.story-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.story-list { display: grid; gap: 22px; padding-top: 20px; }
.story-card { display: grid; grid-template-columns: 240px 1fr; gap: 24px; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); transition: transform .45s var(--ease-premium), box-shadow .45s var(--ease-premium), border-color .45s var(--ease-premium); }
.story-grid .story-card { grid-template-columns: 1fr; }
.story-media { min-height: 210px; background: var(--mist); overflow: hidden; }
.story-media img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s var(--ease-premium), filter .7s var(--ease-premium); }
.story-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(12,107,85,.22); }
.story-card:hover img, .project-card:hover img, .image-card:hover img { transform: scale(1.035); }
.story-content, .project-info { padding: 26px; }
.story-content h2 { font-size: clamp(1.35rem, 2.2vw, 2.2rem); }
.text-link { color: var(--forest); font-weight: 850; text-decoration: underline; text-decoration-color: rgba(12,107,85,.3); text-underline-offset: 4px; transition: color .28s var(--ease-premium), text-decoration-color .28s var(--ease-premium); }
.text-link:hover { color: #084f40; text-decoration-color: currentColor; }
.about-preview, .page-hero, .simple-hero, .project-hero-grid, .contact-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .92fr); gap: clamp(28px, 6vw, 70px); align-items: center; }
.about-preview { border-top: 1px solid var(--line); }
.image-card { margin: 0; overflow: hidden; border-radius: var(--radius); box-shadow: var(--shadow); background: #fff; transition: transform .45s var(--ease-premium), box-shadow .45s var(--ease-premium); }
.image-card:hover { transform: translateY(-4px); box-shadow: 0 34px 100px rgba(22,34,31,.2); }
.image-card img { width: 100%; aspect-ratio: 1.1; object-fit: cover; transition: transform .75s var(--ease-premium), filter .75s var(--ease-premium); }
.cta-band { width: min(1120px, calc(100% - 40px)); margin: 0 auto 90px; padding: clamp(44px, 7vw, 80px); color: #fff; border-radius: var(--radius); background: linear-gradient(135deg, var(--blue) 0%, #0f4a6e 42%, var(--forest) 100%); box-shadow: var(--shadow); }
.cta-band .eyebrow { color: var(--gold); }
.page-title { width: min(980px, calc(100% - 40px)); margin: 0 auto; padding: clamp(72px, 10vw, 120px) 0 40px; text-align: center; }
.page-title.left { text-align: left; }
.page-title h1, .article-hero h1 { font-size: clamp(3rem, 7vw, 6rem); }
.page-title p { color: var(--muted); max-width: 760px; margin-left: auto; margin-right: auto; }
.page-hero.dark { width: 100%; padding: clamp(70px, 10vw, 120px) max(20px, calc((100vw - 1120px)/2)); background: linear-gradient(135deg, #10231f, #0c6b55); color: #fff; }
.page-hero.dark * { color: inherit; }
.page-copy p { color: rgba(255,255,255,.84); }
.article-flow { max-width: 900px; }
.article-flow h2:first-child { text-align: center; }
.cta-inline { display: flex; gap: 12px; margin-top: 30px; flex-wrap: wrap; }
.article-hero { width: min(980px, calc(100% - 40px)); margin: 0 auto; padding: clamp(60px, 9vw, 110px) 0 36px; }
.article-hero h1 { max-width: 920px; }
.lead { color: var(--muted); font-size: clamp(1.1rem, 2vw, 1.35rem); max-width: 760px; }
.back-link { display: inline-flex; margin-bottom: 24px; color: var(--forest); font-weight: 850; }
.article-body { width: min(900px, calc(100% - 40px)); margin: 0 auto; padding-bottom: 90px; }
.article-cover { width: 100%; max-height: 520px; object-fit: cover; border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 40px; transition: transform .55s var(--ease-premium), box-shadow .55s var(--ease-premium); }
.article-cover:hover { transform: translateY(-3px); box-shadow: 0 34px 100px rgba(22,34,31,.2); }
.article-copy { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: clamp(26px, 5vw, 58px); box-shadow: var(--soft); }
.media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; }
.media-grid img { width: 100%; height: 230px; object-fit: cover; border-radius: var(--radius); box-shadow: var(--soft); cursor: zoom-in; transition: transform .65s var(--ease-premium), box-shadow .65s var(--ease-premium), filter .65s var(--ease-premium); }
.media-grid img:hover { transform: translateY(-3px) scale(1.025); box-shadow: var(--shadow); }
.project-list { display: grid; gap: 26px; }
.project-card { display: grid; grid-template-columns: .95fr 1fr; background: #fff; border-radius: var(--radius); border: 1px solid var(--line); overflow: hidden; box-shadow: var(--soft); transition: transform .45s var(--ease-premium), box-shadow .45s var(--ease-premium), border-color .45s var(--ease-premium); }
.project-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(12,107,85,.22); }
.project-image { min-height: 360px; overflow: hidden; }
.project-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .75s var(--ease-premium), filter .75s var(--ease-premium); }
.project-hero { padding: clamp(60px, 9vw, 110px) 0 0; width: min(1120px, calc(100% - 40px)); margin: 0 auto; }
.gallery-masonry { columns: 3 260px; column-gap: 16px; }
.gallery-tile { display: block; width: 100%; margin: 0 0 16px; padding: 0; border: 0; border-radius: var(--radius); overflow: hidden; background: transparent; cursor: zoom-in; box-shadow: var(--soft); break-inside: avoid; transition: transform .45s var(--ease-premium), box-shadow .45s var(--ease-premium); }
.gallery-tile img { width: 100%; transition: transform .75s var(--ease-premium), filter .75s var(--ease-premium); }
.gallery-tile:hover { transform: translateY(-4px); box-shadow: var(--shadow); }
.gallery-tile:hover img { transform: scale(1.04); }

.gallery-page .gallery-shell { width: min(980px, calc(100% - 40px)); margin: 0 auto; padding: clamp(40px, 6vw, 72px) 0 clamp(70px, 10vw, 120px); }
.gallery-layout-block { margin-bottom: clamp(44px, 7vw, 72px); scroll-margin-top: 96px; }
.gallery-section-title { text-align: center; font-family: Georgia, "Times New Roman", ui-serif, serif; font-size: clamp(1.65rem, 3vw, 2.1rem); font-weight: 700; color: var(--blue); margin: 0 0 1.35rem; letter-spacing: 0; }
.gallery-subsection-title { text-align: center; font-family: Georgia, "Times New Roman", ui-serif, serif; font-size: clamp(1.25rem, 2.4vw, 1.65rem); font-style: italic; font-weight: 700; color: var(--blue); margin: 0 0 1.25rem; letter-spacing: 0; }
.gallery-chamber-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.gallery-chamber-grid .gallery-tile { margin-bottom: 0; }
.gallery-chamber-grid .gallery-tile img { aspect-ratio: 4/3; object-fit: cover; height: auto; }
.gallery-hero-wrap { position: relative; border-radius: var(--radius); overflow: hidden; margin-bottom: 14px; box-shadow: var(--soft); }
.gallery-hero-wrap .gallery-tile { margin: 0; border-radius: 0; box-shadow: none; position: relative; z-index: 2; }
.gallery-hero-wrap .gallery-tile img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
.gallery-hero-wrap::after { content: ""; position: absolute; inset: 0; background: rgba(19, 63, 132, .38); pointer-events: none; z-index: 1; border-radius: inherit; }
.gallery-video-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
.gallery-video-cell { position: relative; border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); min-height: 200px; }
.gallery-video-cell .gallery-tile { position: relative; z-index: 1; margin: 0; height: 100%; min-height: inherit; border-radius: 0; box-shadow: none; }
.gallery-video-cell .gallery-tile img { width: 100%; height: 100%; min-height: 220px; object-fit: cover; }
.gallery-video-cell.gallery-play-overlay::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, .06); pointer-events: none; z-index: 2; border-radius: inherit; }
.gallery-play-dot { position: absolute; left: 50%; top: 50%; width: 62px; height: 62px; margin: -31px 0 0 -31px; border-radius: 50%; background: rgba(19, 63, 132, .88); pointer-events: none; z-index: 3; box-shadow: 0 8px 24px rgba(0, 0, 0, .2); }
.gallery-play-triangle { position: absolute; left: 50%; top: 50%; width: 0; height: 0; margin: -10px 0 0 -6px; border-style: solid; border-width: 10px 0 10px 16px; border-color: transparent transparent transparent rgba(255, 255, 255, .95); pointer-events: none; z-index: 4; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .25)); }
.gallery-teaching-head .gallery-section-title { margin-bottom: .75rem; }
.gallery-team-tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 2rem; }
.gallery-team-tabs a { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 999px; border: 2px solid rgba(19, 63, 132, .42); color: #4c3d8f; font-weight: 750; font-size: .94rem; background: #fff; transition: background .28s var(--ease-premium), border-color .28s var(--ease-premium), color .28s var(--ease-premium); }
.gallery-team-tabs a:hover { background: rgba(19, 63, 132, .08); border-color: var(--blue); color: var(--blue); }
.gallery-team-tabs a.is-active { background: rgba(19, 63, 132, .1); border-color: var(--blue); color: var(--blue); }
.gallery-math1-top { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.gallery-math1-top .gallery-tile { margin-bottom: 0; }
.gallery-math1-top .gallery-tile img { aspect-ratio: 16/10; object-fit: cover; }
.gallery-math1-bottom { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
.gallery-math1-bottom .gallery-tile { margin-bottom: 0; }
.gallery-math1-bottom .gallery-tile img { width: 100%; height: 100%; object-fit: cover; min-height: 240px; }
.gallery-math2-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.gallery-math2-row .gallery-tile { margin-bottom: 0; }
.gallery-math2-row .gallery-tile img { aspect-ratio: 3/2; object-fit: cover; }
.gallery-instructors { color: var(--blue); font-weight: 650; margin: 0 0 1.15rem; font-size: 1rem; line-height: 1.45; }
.gallery-instructors-between { margin: 1.15rem 0; text-align: left; }
.gallery-writing-single { max-width: 640px; margin: 0 auto 1.15rem; }
.gallery-writing-single .gallery-tile { margin-bottom: 0; }
.gallery-writing-single .gallery-tile img { aspect-ratio: 3/2; object-fit: cover; }
.gallery-spanish-hero { margin-bottom: 14px; border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); }
.gallery-spanish-hero .gallery-tile { margin: 0; }
.gallery-spanish-hero .gallery-tile img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
.gallery-spanish-wide { margin-top: 14px; border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); }
.gallery-spanish-wide .gallery-tile { margin: 0; }
.gallery-spanish-wide .gallery-tile img { width: 100%; aspect-ratio: 2/1; object-fit: cover; display: block; }
.gallery-bookclub-photo { margin-bottom: 0; border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); }
.gallery-bookclub-photo .gallery-tile { margin: 0; }
.gallery-bookclub-photo .gallery-tile img { width: 100%; object-fit: cover; }
.gallery-bookclub-divider { text-align: center; font-family: Georgia, "Times New Roman", ui-serif, serif; font-size: clamp(1.25rem, 2.4vw, 1.55rem); font-weight: 700; font-style: italic; color: var(--blue); margin: 1.25rem 0; line-height: 1.2; }
.gallery-tech-title { text-align: center; font-family: Georgia, "Times New Roman", ui-serif, serif; font-size: clamp(1.85rem, 4vw, 2.6rem); font-weight: 800; letter-spacing: .02em; color: var(--blue); margin: 0 0 .75rem; }
.gallery-tech-members { text-align: center; color: var(--blue); font-weight: 650; margin: 0 0 1.25rem; font-size: 1rem; }
.gallery-tech-photo { max-width: 720px; margin: 0 auto; border-radius: var(--radius); overflow: hidden; box-shadow: var(--soft); }
.gallery-tech-photo .gallery-tile { margin: 0; }
.gallery-tech-photo .gallery-tile img { width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.gallery-writing-block .gallery-instructors,
.gallery-spanish-block .gallery-instructors,
.gallery-bookclub-block .gallery-instructors { text-align: center; }
@media (max-width: 720px) {
  .gallery-video-row,
  .gallery-math1-bottom { grid-template-columns: 1fr; }
  .gallery-math1-bottom .gallery-tile img { min-height: 200px; }
}
.compact-info { max-width: 900px; }
.contact-grid { align-items: stretch; padding-top: 20px; }
.contact-card h2 { font-size: 1.05rem; margin-top: 1.4rem; color: var(--forest); }
.contact-card h2:first-child { margin-top: 0; }
.map-card { min-height: 420px; border-radius: var(--radius); border: 1px solid var(--line); background: radial-gradient(circle at 25% 20%, rgba(216,156,53,.28), transparent 34%), radial-gradient(circle at 80% 72%, rgba(215,108,75,.18), transparent 34%), linear-gradient(135deg, #e7f1ed, #fff); box-shadow: var(--soft); display: grid; place-items: center; color: var(--muted); font-weight: 850; }
.contact-note { grid-column: 1 / 2; color: var(--muted); }
.signup-card { border-top-color: var(--forest); }
.signup-card label { display: grid; gap: 8px; margin: 20px 0; color: var(--muted); font-weight: 800; }
.signup-card input { min-height: 50px; border: 1px solid var(--line); border-radius: var(--radius); padding: 0 14px; font: inherit; }
.form-message { color: var(--forest); font-weight: 800; }
.simple-hero { width: min(1000px, calc(100% - 40px)); margin: 0 auto; padding: clamp(70px, 10vw, 120px) 0; }
.simple-hero h1 { font-size: clamp(3rem, 7vw, 5.8rem); }
.people-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.person-card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--soft); padding: 18px; transition: transform .45s var(--ease-premium), box-shadow .45s var(--ease-premium), border-color .45s var(--ease-premium); }
.person-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); border-color: rgba(12,107,85,.22); }
.person-card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; margin-bottom: 18px; transition: transform .7s var(--ease-premium), filter .7s var(--ease-premium); }
.person-card:hover img { transform: scale(1.025); }
.person-card h2 { font-size: 1.45rem; }
.site-footer { background: #10231f; color: rgba(255,255,255,.78); padding: 52px clamp(20px, 5vw, 72px); display: grid; grid-template-columns: 1fr auto; gap: 28px; }
.footer-brand { color: #fff; font-weight: 900; font-size: 1.2rem; }
.footer-links { display: flex; flex-wrap: wrap; gap: 14px; font-weight: 800; }
.footer-links a:hover { color: var(--gold); }
.copyright { grid-column: 1 / -1; color: rgba(255,255,255,.56); font-size: .9rem; margin: 0; }
.reveal { opacity: 1; transform: none; animation: fadeUp .7s cubic-bezier(.22,1,.36,1) both; }
.reveal.is-visible { opacity: 1; transform: none; }
.zoomable-image { cursor: zoom-in; transform-origin: center; will-change: transform; }
.zoomable-image:active { transform: scale(.985); }
.image-zoom-overlay { position: fixed; inset: 0; z-index: 100; width: 100%; height: 100%; padding: 0; border: 0; background: rgba(7, 15, 14, .1); opacity: 0; cursor: zoom-out; backdrop-filter: blur(0); transition: opacity .42s var(--ease-premium), background .42s var(--ease-premium), backdrop-filter .42s var(--ease-premium); }
.image-zoom-overlay.is-open { opacity: 1; background: rgba(7, 15, 14, .82); backdrop-filter: blur(14px); }
.image-zoom-clone { position: fixed; top: 0; left: 0; z-index: 101; max-width: none; object-fit: cover; cursor: zoom-out; box-shadow: 0 20px 52px rgba(0,0,0,.22); will-change: transform, width, height, border-radius, box-shadow; transition: transform .68s var(--ease-premium), width .68s var(--ease-premium), height .68s var(--ease-premium), border-radius .68s var(--ease-premium), box-shadow .68s var(--ease-premium); }
.image-zoom-clone.is-open { box-shadow: 0 32px 120px rgba(0,0,0,.42); }
@keyframes slowZoom { from { transform: scale(1.02); } to { transform: scale(1.09); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 900px) {
  .site-header { align-items: flex-start; min-height: auto; flex-wrap: wrap; }
  .nav-toggle { display: inline-flex; }
  .site-nav { display: none; width: 100%; flex-wrap: wrap; padding-top: 8px; }
  .site-nav.open { display: flex; }
  .hero { min-height: 720px; }
  .hero-stats, .story-grid, .story-card, .about-preview, .page-hero, .simple-hero, .project-hero-grid, .contact-grid, .project-card, .split-section { grid-template-columns: 1fr; }
  .story-card { gap: 0; }
  .media-grid, .people-grid { grid-template-columns: repeat(2, 1fr); }
  .site-footer { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  body { font-size: 15px; }
  .site-header { padding: 12px 16px; gap: 12px; }
  .brand { gap: 10px; min-width: 0; }
  .brand img { width: 46px; height: 46px; }
  .brand span { max-width: 178px; line-height: 1.15; font-size: .98rem; }
  .nav-toggle { margin-left: auto; }
  .hero-content { padding-bottom: 56px; }
  .hero-stats { display: none; }
  .section-heading { align-items: flex-start; flex-direction: column; }
  .media-grid, .people-grid { grid-template-columns: 1fr; }
  .feature-panel, .contact-card, .signup-card, .compact-info, .article-copy { padding: 24px; }
  .project-image { min-height: 260px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
  .reveal { opacity: 1; transform: none; animation: none; }
  .image-zoom-overlay { backdrop-filter: none; }
}`;

const js = `document.addEventListener("DOMContentLoaded", () => {
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
});`;

cleanAssetDirectory();
writeAssets();
buildHome();
buildAbout();
buildAnnouncements();
buildProjects();
buildGallery();
buildContact();
buildSimplePages();

console.log("Rebuilt static site from source materials.");
