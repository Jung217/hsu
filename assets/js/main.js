/* ============================================================
   HSU Photography — 互動邏輯
   ★★ 只要改這裡：填入你的 Instagram 與 Email ★★
   ============================================================ */
const SITE = {
  // 你的 Instagram 完整網址（例：https://www.instagram.com/your_name/）
  instagram: "https://www.instagram.com/godzi_film/",
  // 顯示用的帳號文字（例：@your_name）
  instagramHandle: "@godzi_film",
  // Email（留空字串 "" 就不顯示 Email 按鈕）
  email: "",
};
/* ============================================================ */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 基本：設定、年份、導覽 ---------- */
function applySiteConfig() {
  $$("[data-ig]").forEach((a) => { a.href = SITE.instagram || "#"; });
  $$("[data-ig-handle]").forEach((el) => { el.textContent = SITE.instagramHandle || ""; });
  $$("[data-email]").forEach((a) => {
    if (SITE.email) { a.href = `mailto:${SITE.email}`; a.hidden = false; }
  });
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

function initNav() {
  const nav = $("#nav");
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "關閉選單" : "開啟選單");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) links.querySelector(".nav__link")?.focus();
  };
  const close = () => setOpen(false);
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  $$(".nav__link", links).forEach((l) => l.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { close(); toggle.focus(); }
  });
}

function initLoader() {
  const loader = $("#loader");
  const done = () => loader && loader.classList.add("is-done");
  if (document.readyState === "complete") setTimeout(done, 300);
  else window.addEventListener("load", () => setTimeout(done, 300));
  // 保險：最多 2.5 秒一定收起
  setTimeout(done, 2500);
}

/* ---------- 進場動畫 ---------- */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); obs.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

function observeReveals(root = document) {
  $$(".reveal, .tile", root).forEach((el) => revealObserver.observe(el));
}

/* ---------- 工具 ---------- */
const SUB_LABEL = (name) => {
  if (!name) return "";
  if (name.includes("動態")) return "動態車拍";
  return name;
};

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

/* ---------- HERO 背景輪播 ---------- */
function initHero(photos) {
  const bg = $("#heroBg");
  if (!bg) return;
  const pool = photos.filter((p) => p.catSlug === "cars" || p.catSlug === "scenery");
  const src = pool.length ? pool : photos;
  // 取最多 5 張、平均分布
  const picks = [];
  const step = Math.max(1, Math.floor(src.length / 5));
  for (let i = 0; i < src.length && picks.length < 5; i += step) picks.push(src[i]);
  if (!picks.length) return;

  // 第一張已寫在 HTML（靜態 <img>，利於 LCP 預載）；其餘延後載入避免首屏搶頻寬
  const hasStatic = !!bg.querySelector(".slide");
  picks.forEach((p, i) => {
    if (i === 0 && hasStatic) return;
    const s = document.createElement("div");
    s.className = "slide";
    s.dataset.bg = p.full; // 真正切到時才載
    bg.appendChild(s);
  });

  const slides = $$(".slide", bg);
  if (slides.length < 2 || prefersReduced) return;
  let idx = 0;
  setInterval(() => {
    slides[idx].classList.remove("is-active");
    idx = (idx + 1) % slides.length;
    const next = slides[idx];
    if (next.dataset.bg) {
      next.style.backgroundImage = `url("${next.dataset.bg}")`;
      next.removeAttribute("data-bg");
    }
    next.classList.add("is-active");
  }, 5000);
}

/* ---------- 作品集圖牆 ---------- */
const state = { photos: [], visible: [], cat: "all", sub: "all" };

function buildFilters(data) {
  const top = $("#workFilters");
  const subWrap = $("#workSubFilters");

  const mkBtn = (label, value, count, group) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter";
    b.dataset.value = value;
    b.dataset.group = group;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${label}${count != null ? ` <span class="count">${count}</span>` : ""}`;
    return b;
  };

  const setActive = (container, btn) => {
    $$(".filter", container).forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
    btn.classList.add("is-active");
    btn.setAttribute("aria-pressed", "true");
  };

  // 頂層：全部 + 各分類
  top.appendChild(mkBtn("全部", "all", data.total, "top"));
  data.categories.forEach((c) => top.appendChild(mkBtn(c.name, c.slug, c.count, "top")));
  setActive(top, $(".filter", top));

  const renderSub = (catSlug) => {
    subWrap.innerHTML = "";
    const cat = data.categories.find((c) => c.slug === catSlug);
    if (!cat || !cat.subs || !cat.subs.length) { subWrap.hidden = true; return; }
    subWrap.hidden = false;
    subWrap.appendChild(mkBtn("全部", "all", null, "sub"));
    // 子分類排序：把「其他」移到最後
    const subs = [...cat.subs].sort((a, b) => (a.name === "其他" ? 1 : 0) - (b.name === "其他" ? 1 : 0));
    subs.forEach((s) => subWrap.appendChild(mkBtn(SUB_LABEL(s.name), s.id, s.count, "sub")));
    setActive(subWrap, $(".filter", subWrap));
  };

  top.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    setActive(top, btn);
    state.cat = btn.dataset.value;
    state.sub = "all";
    renderSub(state.cat);
    applyFilter();
  });

  subWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    setActive(subWrap, btn);
    state.sub = btn.dataset.value;
    applyFilter();
  });
}

function buildGallery() {
  const grid = $("#gallery");
  grid.innerHTML = "";
  state.photos.forEach((p, i) => {
    const fig = document.createElement("figure");
    fig.className = "tile reveal";
    fig.dataset.idx = String(i);
    fig.dataset.cat = p.catSlug;
    fig.dataset.sub = p.subId || "";
    fig.tabIndex = 0;
    fig.setAttribute("role", "button");
    const label = p.sub ? `${p.cat}・${SUB_LABEL(p.sub)}` : p.cat;
    fig.setAttribute("aria-label", `放大檢視 ${label}`);
    fig.innerHTML = `
      <img src="${p.thumb}" alt="${label}照片" loading="lazy" decoding="async"
           width="${p.w}" height="${p.h}" style="aspect-ratio:${p.w}/${p.h}" />
      <figcaption class="tile__tag">${label}</figcaption>`;
    fig.addEventListener("click", () => openLightbox(Number(fig.dataset.idx)));
    fig.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(Number(fig.dataset.idx)); }
    });
    grid.appendChild(fig);
  });
  observeReveals(grid);
  applyFilter();
}

function applyFilter() {
  const tiles = $$("#gallery .tile");
  state.visible = [];
  tiles.forEach((t) => {
    const okCat = state.cat === "all" || t.dataset.cat === state.cat;
    const okSub = state.sub === "all" || t.dataset.sub === state.sub;
    const show = okCat && okSub;
    t.hidden = !show;
    if (show) {
      t.classList.add("is-in");
      state.visible.push(Number(t.dataset.idx));
    }
  });
  $("#galleryEmpty").hidden = state.visible.length > 0;
  const st = $("#galleryStatus");
  if (st) st.textContent = state.visible.length ? `顯示 ${state.visible.length} 張照片` : "此分類暫無照片";
}

/* ---------- 燈箱 ---------- */
const lb = {
  el: null, img: null, cat: null, count: null,
  pos: 0, lastFocus: null, open: false,
};

function setBackgroundInert(on) {
  ["#main", ".nav", ".footer"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.inert = on;
  });
}

function initLightbox() {
  lb.el = $("#lightbox");
  lb.img = $("#lbImg");
  lb.cat = $("#lbCat");
  lb.count = $("#lbCount");
  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", () => step(-1));
  $("#lbNext").addEventListener("click", () => step(1));
  lb.el.addEventListener("click", (e) => { if (e.target === lb.el) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.open) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      // 焦點循環，限制在燈箱三顆按鈕內
      const items = [$("#lbPrev"), $("#lbNext"), $("#lbClose")].filter((b) => b && !b.hidden);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // 觸控滑動
  let x0 = null;
  lb.el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
}

function renderLightbox() {
  const photoIdx = state.visible[lb.pos];
  const p = state.photos[photoIdx];
  if (!p) return;
  const label = p.sub ? `${p.cat}・${SUB_LABEL(p.sub)}` : p.cat;
  lb.img.src = p.full;
  lb.img.alt = `${label}照片`;
  lb.cat.textContent = label;
  lb.count.textContent = `${lb.pos + 1} / ${state.visible.length}`;
  // 預載相鄰
  [lb.pos - 1, lb.pos + 1].forEach((i) => {
    const vi = state.visible[(i + state.visible.length) % state.visible.length];
    if (vi != null) { const im = new Image(); im.src = state.photos[vi].full; }
  });
}

function openLightbox(photoIdx) {
  const pos = state.visible.indexOf(photoIdx);
  if (pos === -1) return;
  lb.pos = pos;
  lb.open = true;
  lb.lastFocus = document.activeElement;
  lb.el.hidden = false;
  setBackgroundInert(true);
  requestAnimationFrame(() => lb.el.classList.add("is-open"));
  document.body.style.overflow = "hidden";
  renderLightbox();
  $("#lbClose").focus();
}

function closeLightbox() {
  lb.open = false;
  lb.el.classList.remove("is-open");
  document.body.style.overflow = "";
  setBackgroundInert(false);
  setTimeout(() => { lb.el.hidden = true; }, 250);
  if (lb.lastFocus) lb.lastFocus.focus();
}

function step(dir) {
  if (!state.visible.length) return;
  lb.pos = (lb.pos + dir + state.visible.length) % state.visible.length;
  renderLightbox();
}

/* ---------- 影片 ---------- */
function buildFilms(data) {
  const wrap = $("#filmsGroups");
  wrap.innerHTML = "";
  (data.groups || []).forEach((g) => {
    const sec = document.createElement("div");
    sec.className = "films__group reveal";
    const anyVertical = g.videos.some((v) => v.orientation === "vertical");
    sec.innerHTML = `
      <div class="films__group-head">
        <h3 class="films__group-title">${g.title}</h3>
        <span class="films__group-sub">${g.subtitle || ""}</span>
      </div>
      <div class="film-grid${anyVertical ? " film-grid--vertical" : ""}"></div>`;
    const grid = $(".film-grid", sec);
    g.videos.forEach((v) => grid.appendChild(filmCard(v)));
    wrap.appendChild(sec);
  });
  observeReveals(wrap);
}

function filmCard(v) {
  const card = document.createElement("article");
  card.className = "film";
  const orient = v.orientation === "vertical" ? "vertical" : "landscape";
  const id = (v.youtubeId || "").trim();
  const frame = id
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0"
         title="${v.title}" loading="lazy" allowfullscreen
         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`
    : `<div class="film__placeholder">
         <span class="ph-icon">▶</span>
         <span class="ph-text">待補 YouTube 連結</span>
       </div>`;
  card.innerHTML = `
    <div class="film__frame film__frame--${orient}">${frame}</div>
    <div class="film__meta">
      <span class="film__title">${v.title}</span>
      <span class="film__badge">${orient === "vertical" ? "VERTICAL" : "16:9"}</span>
    </div>`;
  return card;
}

/* ---------- 啟動 ---------- */
async function boot() {
  applySiteConfig();
  initNav();
  initLoader();
  initLightbox();
  observeReveals();

  try {
    const photoData = await getJSON("assets/data/photos.json");
    state.photos = photoData.photos || [];
    initHero(state.photos);
    buildFilters(photoData);
    buildGallery();
  } catch (err) {
    console.error("載入照片失敗：", err);
    $("#gallery").innerHTML = `<p class="gallery__empty">照片載入失敗：${err.message}</p>`;
  }

  try {
    const videoData = await getJSON("assets/data/videos.json");
    buildFilms(videoData);
  } catch (err) {
    console.error("載入影片失敗：", err);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
