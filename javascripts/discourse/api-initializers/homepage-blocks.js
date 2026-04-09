import { apiInitializer } from "discourse/lib/api";

const WRAPPER_CLASS = "homepage-blocks-wrapper";

// Discovery routes considered "the homepage"
const HOME_PATHS = new Set(["/", "/latest", "/categories", "/top", "/new", "/unread"]);

function isHomePath(url) {
  const path = url.split("?")[0].replace(/\/$/, "") || "/";
  return HOME_PATHS.has(path);
}

// Safely escape text so it can be inserted as textContent (no XSS).
function text(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// Parse "Name|URL|Description" lines from the textarea setting.
function parseExternalSites(raw) {
  return (raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", url = "", description = ""] = line.split("|");
      return { name: name.trim(), url: url.trim(), description: description.trim() };
    })
    .filter((s) => s.name && s.url);
}

// Parse "5,12,3" → [5, 12, 3]
function parseCategoryIds(raw) {
  return (raw || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function buildCategoryPill(cat) {
  const a = document.createElement("a");
  a.href = `/c/${cat.slug}/${cat.id}`;
  a.className = "hb-pill";
  a.style.cssText = `background:#${cat.color};color:#${cat.text_color || "ffffff"}`;
  a.textContent = cat.name;
  return a;
}

function buildExternalCard(site) {
  const a = document.createElement("a");
  a.href = site.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "hb-card";

  const name = document.createElement("span");
  name.className = "hb-card__name";
  name.textContent = site.name;
  a.appendChild(name);

  if (site.description) {
    const desc = document.createElement("span");
    desc.className = "hb-card__desc";
    desc.textContent = site.description;
    a.appendChild(desc);
  }

  // External link arrow
  const arrow = document.createElement("span");
  arrow.className = "hb-card__arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  a.appendChild(arrow);

  return a;
}

function buildSection(title, children, extraClass = "") {
  const section = document.createElement("div");
  section.className = `hb-section ${extraClass}`.trim();

  if (title) {
    const h = document.createElement("h3");
    h.className = "hb-section__title";
    h.textContent = title;
    section.appendChild(h);
  }

  const row = document.createElement("div");
  row.className = "hb-row";
  children.forEach((el) => row.appendChild(el));
  section.appendChild(row);

  return section;
}

function inject(api) {
  // Remove any previously injected wrapper first
  document.querySelectorAll(`.${WRAPPER_CLASS}`).forEach((el) => el.remove());

  const url = window.location.pathname + window.location.search;
  if (settings.homepage_only && !isHomePath(url)) return;

  const externalSites = parseExternalSites(settings.external_sites);
  const categoryIds = parseCategoryIds(settings.featured_category_ids);

  if (!externalSites.length && !categoryIds.length) return;

  // Resolve category objects from Discourse's site data
  const allCategories = api.container.lookup("service:site")?.categories ?? [];
  const featured = categoryIds
    .map((id) => allCategories.find((c) => c.id === id))
    .filter(Boolean);

  const wrapper = document.createElement("div");
  wrapper.className = WRAPPER_CLASS;

  if (featured.length) {
    wrapper.appendChild(
      buildSection(
        settings.categories_title,
        featured.map(buildCategoryPill),
        "hb-section--categories"
      )
    );
  }

  if (externalSites.length) {
    wrapper.appendChild(
      buildSection(
        settings.external_sites_title,
        externalSites.map(buildExternalCard),
        "hb-section--external"
      )
    );
  }

  // Insert above the topic list / list controls
  const anchor =
    document.querySelector(".list-controls") ||
    document.querySelector(".topic-list") ||
    document.querySelector(".category-list");

  if (anchor) {
    anchor.parentNode.insertBefore(wrapper, anchor);
  }
}

export default apiInitializer("1.0", (api) => {
  api.onPageChange(() => inject(api));
});
