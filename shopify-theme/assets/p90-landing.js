import Lenis from "lenis";
const CDN = "https://cdn.shopify.com/s/files/1/1003/5724/3264";
const SHOP = "https://pilota90.com";
const FONT_BASE = 16, BASE_W = 1920, COEF = 0.6666;
const MIN_VISIBLE_MS = 1400, MAX_VISIBLE_MS = 2600, EXIT_MS = 850;
const COLLECTION_INTERVAL = 3800;
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASES = {
expo: "cubic-bezier(0.16, 1, 0.3, 1)",
quart: "cubic-bezier(0.25, 1, 0.5, 1)",
cubic: "cubic-bezier(0.65, 0, 0.35, 1)"
};
const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function syncRootFontSize() {
const reduction = ((BASE_W - window.innerWidth) / BASE_W) * 100 * COEF;
const size = FONT_BASE - (FONT_BASE * reduction) / 100;
if (size > FONT_BASE) document.documentElement.style.fontSize = size + "px";
else document.documentElement.style.removeProperty("font-size");
}
syncRootFontSize();
window.addEventListener("resize", syncRootFontSize);
window.scrollTo(0, 0);
const lenis = new Lenis({ smoothWheel: true });
let locks = 0;
function lockScroll() {
locks++;
document.documentElement.classList.add("scroll-locked");
lenis.stop();
}
function unlockScroll() {
locks = Math.max(0, locks - 1);
if (locks === 0) {
document.documentElement.classList.remove("scroll-locked");
lenis.start();
}
}
const springs = new Set();
function applyProps(el, p) {
let t = "";
if ("x" in p) t += "translateX(" + p.x + "px) ";
if ("y" in p) t += "translateY(" + p.y + "px) ";
if ("scale" in p) t += "scale(" + p.scale + ") ";
if ("rotate" in p) t += "rotate(" + p.rotate + "deg)";
if (t) el.style.transform = t.trim();
if ("opacity" in p) el.style.opacity = p.opacity;
}
class Spring {
constructor(el, from, config, apply) {
this.el = el;
this.p = Object.assign({}, from);
this.t = Object.assign({}, from);
this.v = {};
for (const k in from) this.v[k] = 0;
this.config = config || { tension: 200, friction: 26 };
this.apply = apply || applyProps;
this.active = false;
springs.add(this);
this.render();
}
to(target, config) {
if (config) this.config = config;
Object.assign(this.t, target);
this.active = true;
}
set(vals) {
Object.assign(this.p, vals);
Object.assign(this.t, vals);
for (const k in vals) this.v[k] = 0;
this.active = false;
this.render();
}
step(dt) {
if (!this.active) return;
const { tension, friction } = this.config;
let moving = false;
for (const k in this.p) {
const d = this.p[k] - this.t[k];
const a = -tension * d - friction * this.v[k];
this.v[k] += a * dt;
this.p[k] += this.v[k] * dt;
if (Math.abs(this.p[k] - this.t[k]) > 0.0008 || Math.abs(this.v[k]) > 0.0008) moving = true;
}
if (!moving) {
Object.assign(this.p, this.t);
for (const k in this.v) this.v[k] = 0;
this.active = false;
}
this.render();
}
render() { this.apply(this.el, this.p); }
}
const parallaxItems = [];
function registerParallax(el, axis, from, to) {
const host = el.closest("section") || el.parentElement;
parallaxItems.push({ el, axis, from, to, host });
}
function stepParallax() {
const vh = window.innerHeight;
for (const it of parallaxItems) {
const r = it.host.getBoundingClientRect();
let p = (vh - r.top) / (vh + r.height);
p = Math.min(1, Math.max(0, p));
const val = it.from + (it.to - it.from) * p;
it.el.style.transform = it.axis === "x" ? "translateX(" + val + "%)" : "translateY(" + val + "%)";
}
}
let last = performance.now();
function raf(time) {
lenis.raf(time);
let dt = (time - last) / 1000;
last = time;
if (dt > 1 / 30) dt = 1 / 30;
for (const s of springs) s.step(dt);
stepParallax();
requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
function clipSpan(text) {
const clip = document.createElement("span");
clip.className = "clip";
const inner = document.createElement("span");
inner.textContent = text;
clip.appendChild(inner);
return clip;
}
function txOptions(el) {
return {
stagger: Number(el.dataset.stagger || 120),
baseDelay: Number(el.dataset.baseDelay || 0),
duration: Number(el.dataset.duration || 950),
ease: EASES[el.dataset.ease || "expo"]
};
}
function txTransition(el, o) {
$$(".clip > span", el).forEach((inner, i) => {
inner.style.transition =
"transform " + o.duration + "ms " + o.ease + ", opacity " + o.duration + "ms " + o.ease;
inner.style.transitionDelay = (o.baseDelay + i * o.stagger) + "ms";
});
}
function buildWords(el, text) {
const o = txOptions(el);
el.textContent = "";
text.split(/\s+/).filter(Boolean).forEach((w, i, arr) => {
el.appendChild(clipSpan(w));
if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
});
txTransition(el, o);
}
function buildLines(el, lines) {
const o = txOptions(el);
el.textContent = "";
lines.forEach((line) => {
const row = document.createElement("span");
row.style.display = "block";
row.appendChild(clipSpan(line));
el.appendChild(row);
});
txTransition(el, o);
}
function fireText(el) { el.classList.add("is-in"); }
function resetText(el) { el.classList.remove("is-in"); void el.offsetWidth; }
function replayWords(el, text) {
resetText(el);
buildWords(el, text);
requestAnimationFrame(() => requestAnimationFrame(() => fireText(el)));
}
let ready = false;
const readyQueue = [];
function whenReady(fn) { if (ready) fn(); else readyQueue.push(fn); }
const io = new IntersectionObserver((entries) => {
entries.forEach((e) => {
if (!e.isIntersecting) return;
io.unobserve(e.target);
const fn = e.target.__reveal;
if (fn) fn();
});
}, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
function observeOnce(el, fn) {
el.__reveal = () => {
if (el.dataset.gate === "ready") whenReady(fn);
else fn();
};
io.observe(el);
}
function setupInview(el) {
const cfg = JSON.parse(el.dataset.inview);
const sp = new Spring(el, cfg.from, cfg.config);
observeOnce(el, () => {
if (cfg.delayIn) setTimeout(() => sp.to(cfg.to), cfg.delayIn);
else sp.to(cfg.to);
});
return sp;
}
function hoverSpring(trigger, target, from, to, config) {
const sp = new Spring(target, from, config);
const enter = () => { if (!isMobile()) sp.to(to); };
const leave = () => { if (!isMobile()) sp.to(from); };
trigger.addEventListener("pointerenter", enter);
trigger.addEventListener("pointerleave", leave);
trigger.addEventListener("focusin", enter);
trigger.addEventListener("focusout", leave);
return sp;
}
const COLLECTIONS = [
{ img: CDN + "/files/pack-mental-complet-2x3-1080x1620.png", brand: "Pack Mental Complet", title: "5 guides · 49 €", cta: "Voir le pack", href: SHOP + "/products/pack-mental-complet-les-5-leviers-pour-que-votre-enfant-donne-son-vrai-niveau-le-jour-j", alt: "Pack Mental Complet — 5 guides PDF" },
{ img: CDN + "/files/PACK_5_08131afc-bff4-4ddd-9fbf-185ded50d217.png", brand: "Le Mental sur 5 Fronts", title: "5 guides · 39,75 €", cta: "Voir le pack", href: SHOP + "/products/pilota90-pack-complet-5-guides-pdf", alt: "Pack 5 guides PDF pour parents et coachs" },
{ img: CDN + "/files/PARENTD_ATHLETE9.163.png", brand: "Parent d’Athlète", title: "Guide PDF · 29 €", cta: "Voir le guide", href: SHOP + "/products/parent-dathlete-la-methode-complete", alt: "Guide Parent d’Athlète" }
];
const COACHES = [
{ img: CDN + "/collections/0001-8401974819238953374.jpg", name: "Pour les Parents", role: "14 guides", alt: "Parents au bord du terrain", headline: ["Trouver", "Les", "Bons", "Mots"], href: SHOP + "/collections/pour-les-parents" },
{ img: CDN + "/collections/0001-1675848778993366780.jpg", name: "Éducateurs & Entraîneurs", role: "11 guides", alt: "Éducateur pendant une séance", headline: ["Corriger", "Sans", "Casser", "L’envie"], href: SHOP + "/collections/pour-les-educateurs-entraineurs" },
{ img: CDN + "/collections/0001-7047517233968956141.jpg", name: "Pour les Joueurs", role: "8 guides", alt: "Jeunes joueurs en action", headline: ["Sous", "Pression", "Jouer", "Libéré"], href: SHOP + "/collections/pour-les-joueurs" }
];
const PROGRAMS = [
{ index: "01", name: "Pack Mental Complet", desc: "Les 5 leviers pour que votre enfant donne son vrai niveau le jour J.", price: "49,00 €", href: SHOP + "/products/pack-mental-complet-les-5-leviers-pour-que-votre-enfant-donne-son-vrai-niveau-le-jour-j" },
{ index: "02", name: "Le Mental sur 5 Fronts", desc: "Le pack 5 guides pour parents et coachs.", price: "39,75 €", href: SHOP + "/products/pilota90-pack-complet-5-guides-pdf" },
{ index: "03", name: "Parent d’Athlète", desc: "Tenir votre rôle, du premier club au haut niveau.", price: "29,00 €", href: SHOP + "/products/parent-dathlete-la-methode-complete" },
{ index: "04", name: "Crampes et coups de pompe", desc: "La nutrition sportive de l’athlète.", price: "19,90 €", href: SHOP + "/products/la-nutrition-pour-performer-guide-pdf-44-pages" },
{ index: "05", name: "Ils courent après le ballon", desc: "Leur enseigner l’intelligence de jeu.", price: "19,90 €", href: SHOP + "/products/pilota90-les-bases-du-jeu-intelligent-ebook-pdf" },
{ index: "06", name: "Stress et anxiété de compétition", desc: "L’aider à jouer son vrai niveau.", price: "14,90 €", href: SHOP + "/products/pilota90-stress-anxiete-de-competition" },
{ index: "07", name: "Manque de confiance en soi", desc: "L’aider à oser le jour de la compétition.", price: "14,90 €", href: SHOP + "/products/pilota90-confiance-en-soi-resilience-de-lathlete-ebook-pdf" },
{ index: "08", name: "Motivation en baisse", desc: "Comprendre et raviver l’envie de vos athlètes.", price: "14,90 €", href: SHOP + "/products/pilota90-la-motivation-dans-le-sport-ebook-pdf" },
{ index: "09", name: "Concentration", desc: "Apprenez-lui à revenir dans le match, seul.", price: "14,90 €", href: SHOP + "/products/attention-concentration-guide-pdf" },
{ index: "10", name: "Corriger sans décourager", desc: "La méthode pour éducateurs et coachs.", price: "14,90 €", href: SHOP + "/products/la-correction-positive-guide-pdf" },
{ index: "11", name: "Parent de jeune sportif", desc: "Le soutenir sans l’étouffer, au quotidien.", price: "14,90 €", href: SHOP + "/products/pilota90-lenvironnement-familial-du-jeune-athlete-ebook-pdf" },
{ index: "12", name: "Amis, coéquipiers, club", desc: "L’autre entourage de votre jeune sportif.", price: "14,90 €", href: SHOP + "/products/pilota90-famille-amis-et-performance-ebook-pdf" },
{ index: "13", name: "Équipe en dents de scie", desc: "Le guide de la cohésion d’équipe.", price: "14,90 €", href: SHOP + "/products/pilota90-la-force-mentale-des-equipes-qui-gagnent-ebook-pdf" },
{ index: "14", name: "Consignes mal comprises ?", desc: "Communiquer pour le faire progresser.", price: "14,90 €", href: SHOP + "/products/pilota90-communiquer-pour-performer-ebook-pdf" }
];
const COURTS = [
{ img: CDN + "/files/pack-mental-complet-2x3-1080x1620.png", tone: "clay", name: "Pack Mental Complet", desc: "Les 5 leviers du jour J, réunis en un seul pack — 49,00 €.", alt: "Pack Mental Complet", href: SHOP + "/products/pack-mental-complet-les-5-leviers-pour-que-votre-enfant-donne-son-vrai-niveau-le-jour-j" },
{ img: CDN + "/files/PACK_5_08131afc-bff4-4ddd-9fbf-185ded50d217.png", tone: "blue", name: "Le Mental sur 5 Fronts", desc: "Cinq guides qui se répondent, pour parents et coachs — 39,75 €.", alt: "Pack 5 guides PDF", href: SHOP + "/products/pilota90-pack-complet-5-guides-pdf" }
];
const STATS = [
{ value: "15", label: "Guides au catalogue" },
{ value: "7", label: "Collections thématiques" },
{ value: "2", label: "Packs groupés" },
{ value: "14,90 €", label: "Prix d’entrée du catalogue" }
];
const TESTIMONIALS = [
{ quote: "Emplacement libre — collez ici un avis client réel issu de votre boutique.", name: "Nom du client", role: "Guide acheté" },
{ quote: "Emplacement libre — collez ici un avis client réel issu de votre boutique.", name: "Nom du client", role: "Guide acheté" },
{ quote: "Emplacement libre — collez ici un avis client réel issu de votre boutique.", name: "Nom du client", role: "Guide acheté" }
];
function buildDots(host, count, onPick) {
host.textContent = "";
for (let i = 0; i < count; i++) {
const b = document.createElement("button");
b.type = "button";
b.setAttribute("role", "tab");
b.setAttribute("aria-label", "Go to slide " + (i + 1));
b.appendChild(document.createElement("span"));
b.addEventListener("click", () => onPick(i));
host.appendChild(b);
}
return (active) => {
Array.from(host.children).forEach((b, i) => {
if (i === active) b.setAttribute("aria-current", "true");
else b.removeAttribute("aria-current");
});
};
}
const programList = $("#program-list");
PROGRAMS.forEach((p, i) => {
const li = document.createElement("li");
const a = document.createElement("a");
a.className = "program-row";
a.href = p.href;
a.dataset.inview = JSON.stringify({
from: { opacity: 0, y: 26 }, to: { opacity: 1, y: 0 },
config: { tension: 190, friction: 26 }, delayIn: i * 90
});
a.target = "_blank";
a.rel = "noopener";
a.innerHTML =
'<span class="program-index">' + p.index + "</span>" +
'<span class="program-body"><span class="program-name">' + p.name + "</span>" +
'<span class="program-desc" style="display:block">' + p.desc + "</span></span>" +
'<span class="program-price">' + p.price + "</span>" +
'<span class="program-arrow"><span class="icon-wrap">' + ARROW_SVG + "</span></span>";
li.appendChild(a);
programList.appendChild(li);
hoverSpring(a, $(".icon-wrap", a), { x: 0, opacity: 0.55 }, { x: 8, opacity: 1 }, { tension: 300, friction: 20 });
});
const courtHost = $("#court-cards");
COURTS.forEach((c, i) => {
const fig = document.createElement("figure");
fig.className = "court-card";
fig.dataset.inview = JSON.stringify({
from: { opacity: 0, y: 48 }, to: { opacity: 1, y: 0 },
config: { tension: 180, friction: 26 }, delayIn: i * 140
});
fig.innerHTML =
'<a class="court-link" href="' + c.href + '" target="_blank" rel="noopener" aria-label="' + c.name + '"></a>' +
'<span class="court-img-wrap"><img src="' + c.img + '" alt="' + c.alt + '" loading="lazy" decoding="async" /></span>' +
'<figcaption class="court-cap tone-' + c.tone + '"><span class="k-name" style="display:block">' + c.name + "</span>" +
'<span class="k-desc" style="display:block">' + c.desc + "</span></figcaption>";
courtHost.appendChild(fig);
hoverSpring(fig, $(".court-img-wrap", fig), { scale: 1 }, { scale: 1.03 }, { tension: 300, friction: 22 });
});
const statsGrid = $("#stats-grid");
STATS.forEach((s, i) => {
const wrap = document.createElement("div");
wrap.className = "stat-cell";
wrap.dataset.inview = JSON.stringify({
from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 },
config: { tension: 180, friction: 24 }, delayIn: i * 110
});
wrap.innerHTML =
'<dt class="sr-only">' + s.label + "</dt>" +
'<dd style="margin:0"><span class="stat-value" style="display:block">' + s.value + "</span>" +
'<span class="stat-label" style="display:block">' + s.label + "</span></dd>";
statsGrid.appendChild(wrap);
});
const testimonialGrid = $("#testimonial-grid");
TESTIMONIALS.forEach((t, i) => {
const li = document.createElement("li");
li.dataset.inview = JSON.stringify({
from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 },
config: { tension: 180, friction: 26 }, delayIn: i * 120
});
li.innerHTML =
'<figure class="testimonial-card"><span class="t-quote" aria-hidden="true">&ldquo;</span>' +
"<blockquote>" + t.quote + "</blockquote>" +
'<figcaption><span class="t-name" style="display:block">' + t.name + "</span>" +
'<span class="t-role" style="display:block">' + t.role + "</span></figcaption></figure>";
testimonialGrid.appendChild(li);
hoverSpring(li, $(".testimonial-card", li), { y: 0 }, { y: -8 }, { tension: 300, friction: 22 });
});
$$("[data-inview]").forEach(setupInview);
$$(".tx[data-lines]").forEach((el) => {
buildLines(el, el.dataset.lines.split("|"));
if (el.hasAttribute("data-manual")) return;
observeOnce(el, () => fireText(el));
});
$$(".tx[data-words]").forEach((el) => {
buildWords(el, el.dataset.words);
if (el.hasAttribute("data-manual")) return;
observeOnce(el, () => fireText(el));
});
$$("[data-parallax-y]").forEach((el) => {
const [from, to] = el.dataset.parallaxY.split(",").map(Number);
registerParallax(el, "y", from, to);
});
$$("[data-px]").forEach((el) => {
const [from, to] = el.dataset.px.split(",").map(Number);
registerParallax(el, "x", from, to);
});
const collCard = $("#collection-card");
const collImg = $("#collection-img");
const collBrand = $("#collection-brand");
const collTitle = $("#collection-title");
const collCta = $("#collection-cta");
const collSpring = new Spring(collCard, { opacity: 1, y: 0, scale: 1 }, { tension: 210, friction: 24 });
let collIndex = 0;
const setCollDots = buildDots($("#collection-dots"), COLLECTIONS.length, (i) => {
restartCollAutoplay();
goCollection(i);
});
setCollDots(0);
function paintCollection(i) {
const c = COLLECTIONS[i];
collImg.src = c.img;
collImg.alt = c.alt;
collBrand.textContent = c.brand;
collTitle.textContent = c.title;
collCta.textContent = c.cta + " →";
collCta.href = c.href;
setCollDots(i);
}
function goCollection(i) {
if (i === collIndex) return;
collIndex = i;
collSpring.to({ opacity: 0, y: 16, scale: 0.96 });
setTimeout(() => {
paintCollection(collIndex);
collSpring.set({ opacity: 0, y: 16, scale: 0.96 });
collSpring.to({ opacity: 1, y: 0, scale: 1 });
}, 240);
}
let collTimer = null;
function restartCollAutoplay() {
clearInterval(collTimer);
collTimer = setInterval(() => goCollection((collIndex + 1) % COLLECTIONS.length), COLLECTION_INTERVAL);
}
whenReady(restartCollAutoplay);
const ghostWords = $$("#trust-title [data-slot]").sort(
(a, b) => Number(a.dataset.slot) - Number(b.dataset.slot)
);
const coachImg = $("#coach-img");
const coachLink = $("#coach-link");
const coachName = $("#coach-name");
const coachRole = $("#coach-role");
const coachImgSpring = new Spring(coachImg, { opacity: 1 }, { tension: 260, friction: 26 });
let trustIndex = 0;
ghostWords.forEach((el) => {
el.dataset.duration = "700";
el.dataset.stagger = "0";
el.dataset.ease = "expo";
buildWords(el, COACHES[0].headline[Number(el.dataset.slot)]);
});
observeOnce($("#trust-title"), () => ghostWords.forEach(fireText));
const setTrustDots = buildDots($("#trust-dots"), COACHES.length, (i) => goTrust(i));
setTrustDots(0);
function goTrust(i) {
if (i === trustIndex) return;
trustIndex = i;
const c = COACHES[i];
ghostWords.forEach((el) => replayWords(el, c.headline[Number(el.dataset.slot)]));
coachImgSpring.to({ opacity: 0 });
setTimeout(() => {
coachImg.src = c.img;
coachImg.alt = c.alt;
coachName.textContent = c.name;
coachRole.textContent = c.role;
coachLink.href = c.href;
coachImgSpring.set({ opacity: 0 });
coachImgSpring.to({ opacity: 1 });
}, 200);
setTrustDots(i);
}
$("#trust-prev").addEventListener("click", () => goTrust((trustIndex - 1 + COACHES.length) % COACHES.length));
$("#trust-next").addEventListener("click", () => goTrust((trustIndex + 1) % COACHES.length));
$$(".pill").forEach((el) => {
const w = $(".icon-wrap", el);
if (w) hoverSpring(el, w, { x: 0 }, { x: 5 }, { tension: 320, friction: 20 });
});
$$(".arrow-btn").forEach((el) => {
const w = $(".icon-wrap", el);
if (w) hoverSpring(el, w, { scale: 1 }, { scale: 1.15 }, { tension: 320, friction: 18 });
});
[$("#modal-close"), $("#menu-close")].forEach((el) => {
hoverSpring(el, $(".icon-wrap", el), { rotate: 0 }, { rotate: 90 }, { tension: 300, friction: 18 });
});
function scrollToAnchor(hash) {
const target = document.querySelector(hash);
if (target) lenis.scrollTo(target, { offset: 0 });
}
$$("[data-anchor]").forEach((a) => {
a.addEventListener("click", (e) => {
const hash = a.getAttribute("href");
if (!hash || !hash.startsWith("#")) return;
e.preventDefault();
if (a.hasAttribute("data-menu-link")) closeMenu();
scrollToAnchor(hash);
});
});
const modalRoot = $("#modal-root");
const modalPanel = $("#modal-panel");
const modalBackdrop = $("#modal-backdrop");
const modalForm = $("#modal-form");
const modalSuccess = $("#modal-success");
const modalSubmit = $("#modal-submit");
const modalTitle = $("#modal-title");
const nameField = $("#f-name");
let modalOpen = false;
const modalBackdropSpring = new Spring(modalBackdrop, { opacity: 0 }, { tension: 240, friction: 30 });
const modalPanelSpring = new Spring(modalPanel, { opacity: 0, y: 28, scale: 0.96 }, { tension: 240, friction: 26 });
function openModal() {
if (modalOpen) return;
modalOpen = true;
modalRoot.classList.add("is-open");
modalRoot.setAttribute("aria-hidden", "false");
modalRoot.removeAttribute("inert");
modalBackdropSpring.to({ opacity: 1 });
modalPanelSpring.to({ opacity: 1, y: 0, scale: 1 });
resetText(modalTitle);
requestAnimationFrame(() => requestAnimationFrame(() => fireText(modalTitle)));
lockScroll();
setTimeout(() => nameField.focus(), 120);
}
function closeModal() {
if (!modalOpen) return;
modalOpen = false;
modalRoot.classList.remove("is-open");
modalRoot.setAttribute("aria-hidden", "true");
modalRoot.setAttribute("inert", "");
modalBackdropSpring.to({ opacity: 0 });
modalPanelSpring.to({ opacity: 0, y: 28, scale: 0.96 });
unlockScroll();
setTimeout(() => {
modalForm.reset();
modalForm.hidden = false;
modalSuccess.hidden = true;
modalSubmit.disabled = false;
modalSubmit.textContent = "Envoyer";
}, 350);
}
$$("[data-open-modal]").forEach((b) => b.addEventListener("click", openModal));
$("#modal-close").addEventListener("click", closeModal);
$("#modal-done").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
modalForm.addEventListener("submit", (e) => {
e.preventDefault();
modalSubmit.disabled = true;
modalSubmit.textContent = "Envoi…";
const raw = (nameField.value || "").trim();
const first = raw ? raw.split(/\s+/)[0] : "à vous";
setTimeout(() => {
$("#modal-success-text").textContent =
"Merci " + first + " — formulaire de démonstration, aucun message n’a été envoyé.";
modalForm.hidden = true;
modalSuccess.hidden = false;
}, 700);
});
const menuRoot = $("#menu-root");
const menuPanel = $("#menu-panel");
const menuBackdrop = $("#menu-backdrop");
const menuLinks = $$("#menu-nav a");
let menuOpen = false;
const menuBackdropSpring = new Spring(menuBackdrop, { opacity: 0 }, { tension: 260, friction: 30 });
const menuPanelSpring = new Spring(menuPanel, { opacity: 0, y: -24 }, { tension: 220, friction: 28 });
const menuLinkSprings = menuLinks.map((el) => new Spring(el, { opacity: 0, y: 28 }, { tension: 200, friction: 26 }));
function openMenu() {
if (menuOpen) return;
menuOpen = true;
menuRoot.classList.add("is-open");
menuRoot.setAttribute("aria-hidden", "false");
menuRoot.removeAttribute("inert");
menuBackdropSpring.to({ opacity: 1 });
menuPanelSpring.to({ opacity: 1, y: 0 });
menuLinkSprings.forEach((sp, i) => {
sp.set({ opacity: 0, y: 28 });
setTimeout(() => sp.to({ opacity: 1, y: 0 }), 120 + i * 70);
});
lockScroll();
}
function closeMenu() {
if (!menuOpen) return;
menuOpen = false;
menuRoot.classList.remove("is-open");
menuRoot.setAttribute("aria-hidden", "true");
menuRoot.setAttribute("inert", "");
menuBackdropSpring.to({ opacity: 0 });
menuPanelSpring.to({ opacity: 0, y: -24 });
menuLinkSprings.forEach((sp) => sp.to({ opacity: 0, y: 28 }));
unlockScroll();
}
$("[data-open-menu]").addEventListener("click", openMenu);
$("#menu-close").addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);
$("#menu-book").addEventListener("click", () => { closeMenu(); openModal(); });
document.addEventListener("keydown", (e) => {
if (e.key !== "Escape") return;
if (modalOpen) closeModal();
else if (menuOpen) closeMenu();
});
const loader = $("#loader");
const loaderFill = $("#loader-fill");
const minVisible = REDUCED ? 200 : MIN_VISIBLE_MS;
const exitMs = REDUCED ? 0 : EXIT_MS;
lockScroll();
new Spring($("#loader-mark"), { opacity: 0, y: 16 }, { tension: 200, friction: 22 }).to({ opacity: 1, y: 0 });
const fillDuration = Math.max(0, minVisible - 120);
loaderFill.style.transition = "transform " + fillDuration + "ms " + EASES.cubic + " 120ms";
requestAnimationFrame(() => requestAnimationFrame(() => { loaderFill.style.transform = "scaleX(1)"; }));
let countdownStarted = false;
function startCountdown() {
if (countdownStarted) return;
countdownStarted = true;
setTimeout(revealSite, minVisible);
}
let revealed = false;
function revealSite() {
if (revealed) return;
revealed = true;
ready = true;
while (readyQueue.length) readyQueue.shift()();
unlockScroll();
if (exitMs > 0) {
loader.style.transition = "transform " + exitMs + "ms " + EASES.cubic;
requestAnimationFrame(() => { loader.style.transform = "translateY(-105%)"; });
} else {
loader.style.transform = "translateY(-105%)";
}
setTimeout(() => loader.remove(), exitMs);
}
if (document.readyState === "complete") startCountdown();
else window.addEventListener("load", startCountdown);
setTimeout(startCountdown, MAX_VISIBLE_MS);