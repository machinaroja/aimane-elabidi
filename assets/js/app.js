/* =========================================================================
   MACHINA RAPPORT — Application
   ========================================================================= */

const ETAPES = [
  { cle: "identite",   nom: "Fiche stagiaire",  icone: "1" },
  { cle: "evaluation", nom: "Évaluation",       icone: "2" },
  { cle: "joueur",     nom: "Questions joueur", icone: "3" },
  { cle: "parents",    nom: "Questions parents",icone: "4" },
  { cle: "synthese",   nom: "Synthèse",         icone: "5" },
  { cle: "rapport",    nom: "Rapport",          icone: "6" }
];

let etat = { rapport: null, vue: "accueil", etape: "identite" };

/* ---- Utilitaires d'affichage ------------------------------------------ */

function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function nl2br(v) { return esc(v).replace(/\n/g, "<br>"); }

function nomComplet(r) {
  const n = [r.identite.prenom, r.identite.nom].filter(Boolean).join(" ").trim();
  return n || "Stagiaire sans nom";
}

function prenomOu(r, defaut = "Le stagiaire") {
  return (r.identite.prenom || "").trim() || defaut;
}

function dateFR(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function dateCourteFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

function toast(message, type = "ok") {
  const zone = document.getElementById("toasts");
  const t = document.createElement("div");
  t.className = "toast toast--" + type;
  t.textContent = message;
  zone.appendChild(t);
  setTimeout(() => { t.classList.add("toast--sortie"); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ---- Avancement -------------------------------------------------------- */

function avancement(r) {
  const items = tousLesItems();
  let notesFaites = 0;
  items.forEach(i => {
    const n = r.notes[i.id] || {};
    const attendu = i.structure.double ? 2 : 1;
    let ok = typeof n.P === "number" ? 1 : 0;
    if (attendu === 2 && typeof n.R === "number") ok++;
    notesFaites += ok / attendu;
  });
  const identiteChamps = ["prenom", "nom", "naissance", "poste", "stageDu", "stageAu"];
  const identiteFaite = identiteChamps.filter(c => (r.identite[c] || "").trim() !== "").length / identiteChamps.length;

  const jTotal = compterQuestions(QUESTIONNAIRE_JOUEUR);
  const pTotal = compterQuestions(QUESTIONNAIRE_PARENTS);
  const sChamps = Object.keys(r.synthese);
  const sFaits = sChamps.filter(c => (r.synthese[c] || "").trim() !== "").length;

  return {
    identite:   Math.round(identiteFaite * 100),
    evaluation: Math.round((notesFaites / items.length) * 100),
    joueur:     Math.round((reponsesRemplies(QUESTIONNAIRE_JOUEUR, r.joueur) / jTotal) * 100),
    parents:    Math.round((reponsesRemplies(QUESTIONNAIRE_PARENTS, r.parents) / pTotal) * 100),
    synthese:   Math.round((sFaits / sChamps.length) * 100)
  };
}

function avancementGlobal(r) {
  const a = avancement(r);
  return Math.round((a.identite + a.evaluation + a.joueur + a.parents + a.synthese) / 5);
}

/* ---- Routeur ----------------------------------------------------------- */

function naviguer() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);

  if (parts[0] === "reglages") { etat.vue = "reglages"; return rendre(); }
  if (parts[0] === "r" && parts[1]) {
    const r = lireRapport(parts[1]);
    if (!r) { toast("Rapport introuvable.", "erreur"); location.hash = "#/"; return; }
    etat.rapport = r;
    etat.vue = "rapport";
    etat.etape = ETAPES.some(e => e.cle === parts[2]) ? parts[2] : "identite";
    return rendre();
  }
  etat.vue = "accueil";
  etat.rapport = null;
  rendre();
}

function rendre() {
  const app = document.getElementById("app");
  window.scrollTo(0, 0);
  if (etat.vue === "accueil")  app.innerHTML = vueAccueil();
  else if (etat.vue === "reglages") app.innerHTML = vueReglages();
  else app.innerHTML = vueRapport();
  document.body.dataset.vue = etat.vue;
  document.body.dataset.etape = etat.vue === "rapport" ? etat.etape : "";
}

/* =========================================================================
   VUE ACCUEIL
   ========================================================================= */

function vueAccueil() {
  const rapports = lireRapports();
  const reglages = lireReglages();

  const cartes = rapports.map(r => {
    const pct = avancementGlobal(r);
    const moy = moyenneGenerale(r.notes);
    return `
      <article class="carte" data-id="${esc(r.id)}">
        <div class="carte__haut">
          <div>
            <h3 class="carte__nom">${esc(nomComplet(r))}</h3>
            <p class="carte__meta">${esc(r.identite.poste || "Poste non renseigné")}${r.identite.categorie ? " · " + esc(r.identite.categorie) : ""}</p>
          </div>
          <span class="pastille ${moy === null ? "pastille--vide" : ""}">${moy === null ? "—" : formatNote(moy)}</span>
        </div>
        <p class="carte__stage">${r.identite.stageIntitule ? esc(r.identite.stageIntitule) : "Stage non intitulé"}
          ${r.identite.stageDu ? " · " + dateCourteFR(r.identite.stageDu) : ""}</p>
        <div class="jauge"><span style="width:${pct}%"></span></div>
        <p class="carte__pct">${pct}% complété · modifié le ${dateCourteFR(r.majLe)}</p>
        <div class="carte__actions">
          <a class="btn btn--petit" href="#/r/${esc(r.id)}/identite">Ouvrir</a>
          <a class="btn btn--petit btn--fantome" href="#/r/${esc(r.id)}/rapport">Rapport</a>
          <button class="btn btn--petit btn--fantome" data-action="dupliquer" data-id="${esc(r.id)}">Dupliquer</button>
          <button class="btn btn--petit btn--danger-fantome" data-action="supprimer" data-id="${esc(r.id)}">Supprimer</button>
        </div>
      </article>`;
  }).join("");

  return `
  <header class="entete">
    <div class="entete__marque">
      <div class="logo">MR</div>
      <div>
        <h1>Machina Rapport</h1>
        <p>${esc(reglages.structureNom)} · ${esc(reglages.sousTitre)}</p>
      </div>
    </div>
    <div class="entete__actions">
      <a class="btn btn--fantome" href="#/reglages">Réglages</a>
      <button class="btn btn--fantome" data-action="importer">Importer</button>
      <button class="btn btn--fantome" data-action="exporter-tout" ${rapports.length ? "" : "disabled"}>Exporter tout</button>
      <button class="btn" data-action="nouveau">+ Nouveau rapport</button>
    </div>
  </header>

  <main class="contenu">
    <section class="bandeau">
      <div class="bandeau__stat"><strong>${rapports.length}</strong><span>rapport${rapports.length > 1 ? "s" : ""}</span></div>
      <div class="bandeau__stat"><strong>${STRUCTURES.length}</strong><span>structures évaluées</span></div>
      <div class="bandeau__stat"><strong>${tousLesItems().length}</strong><span>critères</span></div>
      <div class="bandeau__stat"><strong>${compterQuestions(QUESTIONNAIRE_JOUEUR) + compterQuestions(QUESTIONNAIRE_PARENTS)}</strong><span>questions disponibles</span></div>
    </section>

    ${rapports.length ? `<div class="grille">${cartes}</div>` : `
      <div class="vide">
        <h2>Aucun rapport pour le moment</h2>
        <p>Créez un premier rapport pour évaluer un stagiaire sur les six structures Machina,
           recueillir les réponses du joueur et de sa famille, puis générer un document PDF complet.</p>
        <button class="btn btn--grand" data-action="nouveau">Créer un premier rapport</button>
      </div>`}
  </main>
  <input type="file" id="fichier-import" accept="application/json,.json" hidden>`;
}

/* =========================================================================
   VUE RÉGLAGES
   ========================================================================= */

function vueReglages() {
  const g = lireReglages();
  return `
  <header class="entete entete--simple">
    <a class="lien-retour" href="#/">← Retour aux rapports</a>
    <h1>Réglages</h1>
  </header>
  <main class="contenu contenu--etroit">
    <form class="bloc" id="form-reglages">
      <h2>Identité de la structure</h2>
      <div class="champs">
        ${champ("text", "structureNom", "Nom de la structure", g.structureNom)}
        ${champ("text", "sousTitre", "Sous-titre du rapport", g.sousTitre)}
        ${champ("text", "signataire", "Nom du signataire", g.signataire)}
        ${champ("text", "fonction", "Fonction du signataire", g.fonction)}
      </div>

      <h2>Libellés des colonnes de notation</h2>
      <p class="aide">Le référentiel note chaque critère sur deux colonnes. Adaptez les libellés à votre méthodologie.</p>
      <div class="champs">
        ${champ("text", "colP", "Colonne « P »", g.colonnes.P)}
        ${champ("text", "colR", "Colonne « R »", g.colonnes.R)}
      </div>

      <h2>Mention de bas de rapport</h2>
      <div class="champs">
        ${champTexte("mentionFin", "Texte affiché avant la signature", g.mentionFin, 4)}
      </div>

      <div class="barre-actions">
        <button class="btn" type="submit">Enregistrer les réglages</button>
      </div>
    </form>

    <section class="bloc bloc--danger">
      <h2>Données</h2>
      <p class="aide">Toutes les données sont stockées dans ce navigateur uniquement. Exportez régulièrement pour les sauvegarder.</p>
      <div class="barre-actions">
        <button class="btn btn--fantome" data-action="exporter-tout">Exporter toutes les données</button>
        <button class="btn btn--fantome" data-action="importer">Importer un fichier</button>
        <button class="btn btn--danger-fantome" data-action="tout-effacer">Tout effacer</button>
      </div>
    </section>
  </main>
  <input type="file" id="fichier-import" accept="application/json,.json" hidden>`;
}

/* =========================================================================
   VUE RAPPORT (avec étapes)
   ========================================================================= */

function vueRapport() {
  const r = etat.rapport;
  const a = avancement(r);
  const g = lireReglages();

  const onglets = ETAPES.map(e => {
    const pct = a[e.cle];
    const actif = etat.etape === e.cle ? " onglet--actif" : "";
    const fini = pct === 100 ? " onglet--fini" : "";
    return `<a class="onglet${actif}${fini}" href="#/r/${esc(r.id)}/${e.cle}">
      <span class="onglet__num">${e.icone}</span>
      <span class="onglet__nom">${e.nom}</span>
      ${e.cle !== "rapport" ? `<span class="onglet__pct">${pct}%</span>` : ""}
    </a>`;
  }).join("");

  let corps = "";
  if (etat.etape === "identite")   corps = etapeIdentite(r);
  if (etat.etape === "evaluation") corps = etapeEvaluation(r, g);
  if (etat.etape === "joueur")     corps = etapeQuestionnaire(r, QUESTIONNAIRE_JOUEUR, "joueur");
  if (etat.etape === "parents")    corps = etapeQuestionnaire(r, QUESTIONNAIRE_PARENTS, "parents");
  if (etat.etape === "synthese")   corps = etapeSynthese(r);
  if (etat.etape === "rapport")    corps = etapeRapport(r, g);

  const idx = ETAPES.findIndex(e => e.cle === etat.etape);
  const prec = ETAPES[idx - 1], suiv = ETAPES[idx + 1];

  return `
  <header class="entete entete--rapport no-print">
    <a class="lien-retour" href="#/">← Rapports</a>
    <div class="entete__titre">
      <h1>${esc(nomComplet(r))}</h1>
      <p>${esc(r.identite.stageIntitule || "Stage")}${r.identite.stageDu ? " · du " + dateCourteFR(r.identite.stageDu) : ""}${r.identite.stageAu ? " au " + dateCourteFR(r.identite.stageAu) : ""}</p>
    </div>
    <div class="entete__actions">
      <span class="badge">${avancementGlobal(r)}% complété</span>
      <button class="btn btn--fantome" data-action="exporter-un" data-id="${esc(r.id)}">Exporter</button>
      <a class="btn" href="#/r/${esc(r.id)}/rapport">Voir le rapport</a>
    </div>
  </header>

  <nav class="onglets no-print">${onglets}</nav>

  <main class="contenu">${corps}</main>

  <nav class="pied-nav no-print">
    ${prec ? `<a class="btn btn--fantome" href="#/r/${esc(r.id)}/${prec.cle}">← ${prec.nom}</a>` : "<span></span>"}
    ${suiv ? `<a class="btn" href="#/r/${esc(r.id)}/${suiv.cle}">${suiv.nom} →</a>` : "<span></span>"}
  </nav>`;
}

/* ---- Fabriques de champs ---------------------------------------------- */

function champ(type, nom, label, valeur, extra = "") {
  return `<label class="champ">
    <span class="champ__label">${esc(label)}</span>
    <input class="champ__saisie" type="${type}" name="${esc(nom)}" value="${esc(valeur || "")}" ${extra}>
  </label>`;
}

function champTexte(nom, label, valeur, lignes = 3, aide = "") {
  return `<label class="champ champ--large">
    <span class="champ__label">${esc(label)}</span>
    ${aide ? `<span class="champ__aide">${esc(aide)}</span>` : ""}
    <textarea class="champ__saisie" name="${esc(nom)}" rows="${lignes}">${esc(valeur || "")}</textarea>
  </label>`;
}

function champSelect(nom, label, valeur, options, vide = "— Choisir —") {
  const opts = [`<option value="">${esc(vide)}</option>`]
    .concat(options.map(o => `<option value="${esc(o)}" ${o === valeur ? "selected" : ""}>${esc(o)}</option>`))
    .join("");
  return `<label class="champ">
    <span class="champ__label">${esc(label)}</span>
    <select class="champ__saisie" name="${esc(nom)}">${opts}</select>
  </label>`;
}

/* ---- Étape 1 : identité ------------------------------------------------ */

function etapeIdentite(r) {
  const i = r.identite;
  return `
  <form class="bloc" id="form-identite" data-id="${esc(r.id)}">
    <h2>Le stagiaire</h2>
    <div class="champs">
      ${champ("text", "prenom", "Prénom", i.prenom)}
      ${champ("text", "nom", "Nom", i.nom)}
      ${champ("date", "naissance", "Date de naissance", i.naissance)}
      ${champSelect("poste", "Poste principal", i.poste, ["Gardien","Latéral droit","Latéral gauche","Défenseur central","Milieu défensif","Milieu relayeur","Milieu offensif","Ailier droit","Ailier gauche","Attaquant de pointe","Polyvalent"])}
      ${champSelect("piedFort", "Pied fort", i.piedFort, ["Droit","Gauche","Ambidextre"])}
      ${champ("text", "categorie", "Catégorie", i.categorie, 'placeholder="U13, U15…"')}
      ${champ("text", "clubOrigine", "Club d'origine", i.clubOrigine)}
      ${champ("text", "numero", "Numéro de maillot", i.numero)}
    </div>

    <h2>Le stage</h2>
    <div class="champs">
      ${champ("text", "stageIntitule", "Intitulé du stage", i.stageIntitule, 'placeholder="Stage de perfectionnement — Toussaint"')}
      ${champ("text", "lieu", "Lieu", i.lieu)}
      ${champ("date", "stageDu", "Du", i.stageDu)}
      ${champ("date", "stageAu", "Au", i.stageAu)}
      ${champ("text", "groupe", "Groupe / atelier", i.groupe)}
      ${champ("text", "evaluateur", "Évaluateur référent", i.evaluateur)}
    </div>

    <div class="barre-actions">
      <button class="btn" type="submit">Enregistrer</button>
      <span class="aide">Les modifications sont également enregistrées automatiquement.</span>
    </div>
  </form>`;
}

/* ---- Étape 2 : évaluation ---------------------------------------------- */

function etapeEvaluation(r, g) {
  const prenom = prenomOu(r);
  const legende = ECHELLE.map(e =>
    `<li><strong>${e.note}</strong> <span>${esc(e.libelle)}</span><em>${esc(e.desc)}</em></li>`).join("");

  const blocs = STRUCTURES.map(s => {
    const moy = moyenneStructure(s, r.notes);
    const items = s.items.map(it => {
      const n = r.notes[it.id] || {};
      return `
      <div class="critere" data-item="${esc(it.id)}">
        <div class="critere__tete">
          <div>
            <h4>${esc(it.nom)}</h4>
            <p class="critere__def">${esc(it.definition)}</p>
          </div>
        </div>
        <div class="critere__notes">
          ${selecteurNote(it.id, "P", n.P, s.double ? g.colonnes.P : "Note", s.couleur)}
          ${s.double ? selecteurNote(it.id, "R", n.R, g.colonnes.R, s.couleur) : ""}
        </div>
        <div class="critere__commentaire">
          <div class="critere__barre">
            <span class="champ__label">Commentaire du rapport</span>
            <div class="suggestions">
              <span>Suggestions&nbsp;:</span>
              ${[1,2,3,4,5].map(nv => `<button type="button" class="puce" data-action="suggestion" data-item="${esc(it.id)}" data-niveau="${nv}" title="${esc(it.phrases[nv].replace(/\{prenom\}/g, prenom))}">${nv}</button>`).join("")}
            </div>
          </div>
          <textarea class="champ__saisie" data-commentaire="${esc(it.id)}" rows="3"
            placeholder="Observation destinée au rapport final…">${esc(n.commentaire || "")}</textarea>
        </div>
      </div>`;
    }).join("");

    return `
    <section class="structure" style="--couleur:${s.couleur}">
      <header class="structure__tete">
        <div>
          <h3>${esc(s.nom)}</h3>
          <p>${esc(s.resume)}</p>
        </div>
        <span class="structure__moy">${moy === null ? "—" : formatNote(moy)}</span>
      </header>
      <div class="structure__corps">${items}</div>
    </section>`;
  }).join("");

  const moyG = moyenneGenerale(r.notes);

  return `
  <div class="bloc bloc--legende no-print">
    <h2>Échelle de notation</h2>
    <ul class="legende">${legende}</ul>
    <p class="aide">Chaque critère est noté sur deux colonnes — <strong>${esc(g.colonnes.P)}</strong> et <strong>${esc(g.colonnes.R)}</strong> — sauf la structure Coordination, évaluée sur une seule note. Les moyennes sont arrondies au dixième supérieur.</p>
  </div>

  <div class="recap no-print">
    <span class="recap__label">Moyenne générale</span>
    <span class="recap__valeur">${moyG === null ? "—" : formatNote(moyG)}</span>
    <span class="recap__sur">/ 5</span>
  </div>

  <div id="zone-evaluation" data-id="${esc(r.id)}">${blocs}</div>`;
}

function selecteurNote(itemId, colonne, valeur, label, couleur) {
  const boutons = [1,2,3,4,5].map(n =>
    `<button type="button" class="note ${valeur === n ? "note--active" : ""}"
        data-action="note" data-item="${esc(itemId)}" data-col="${colonne}" data-valeur="${n}"
        title="${esc(ECHELLE[n-1].libelle)}">${n}</button>`).join("");
  return `<div class="colonne-note">
    <span class="colonne-note__label">${esc(label)}</span>
    <div class="notes" style="--couleur:${couleur}">${boutons}
      <button type="button" class="note note--raz" data-action="note" data-item="${esc(itemId)}" data-col="${colonne}" data-valeur="" title="Effacer la note">×</button>
    </div>
  </div>`;
}

/* ---- Étapes 3 & 4 : questionnaires -------------------------------------- */

function etapeQuestionnaire(r, banque, cle) {
  const reponses = r[cle];
  const total = compterQuestions(banque);
  const faites = reponsesRemplies(banque, reponses);

  const intro = cle === "joueur"
    ? "Entretien individuel mené avec le stagiaire. Les réponses alimentent la partie « Parole du joueur » du rapport."
    : "Questionnaire transmis à la famille avant le stage, complété lors de l'entretien de restitution. Les réponses alimentent la partie « Regard de la famille » du rapport.";

  const sections = banque.map(section => {
    const questions = section.questions.map(q => rendreQuestion(q, reponses[q.id], cle)).join("");
    const s = section.structure ? trouverStructure(section.structure) : null;
    return `
    <section class="bloc bloc--section" ${s ? `style="--couleur:${s.couleur}"` : ""}>
      <h3 class="${s ? "titre-colore" : ""}">${esc(section.titre)}</h3>
      ${section.intro ? `<p class="aide">${esc(section.intro)}</p>` : ""}
      <div class="questions">${questions}</div>
    </section>`;
  }).join("");

  return `
  <div class="bloc bloc--legende no-print">
    <h2>${cle === "joueur" ? "Questionnaire joueur" : "Questionnaire parents / responsables légaux"}</h2>
    <p class="aide">${intro}</p>
    <div class="jauge jauge--large"><span style="width:${Math.round(faites/total*100)}%"></span></div>
    <p class="aide">${faites} réponse${faites > 1 ? "s" : ""} sur ${total} question${total > 1 ? "s" : ""}.</p>
    <div class="barre-actions">
      <button class="btn btn--fantome btn--petit" data-action="imprimer-questionnaire" data-cle="${cle}">Imprimer le questionnaire vierge</button>
    </div>
  </div>
  <div id="zone-questionnaire" data-cle="${cle}" data-id="${esc(r.id)}">${sections}</div>`;
}

function rendreQuestion(q, valeur, cle) {
  const nom = `q_${q.id}`;
  let saisie = "";

  if (q.type === "textarea") {
    saisie = `<textarea class="champ__saisie" data-question="${esc(q.id)}" rows="3">${esc(valeur || "")}</textarea>`;
  } else if (q.type === "select" || q.type === "echelle") {
    const opts = [`<option value="">— Sans réponse —</option>`]
      .concat(q.options.map(o => `<option value="${esc(o)}" ${o === valeur ? "selected" : ""}>${esc(o)}</option>`)).join("");
    saisie = `<select class="champ__saisie" data-question="${esc(q.id)}">${opts}</select>`;
  } else if (q.type === "oui_non") {
    saisie = `<div class="choix">
      ${["Oui","Non","Ne sait pas"].map(o => `
        <label class="choix__opt ${valeur === o ? "choix__opt--actif" : ""}">
          <input type="radio" name="${esc(nom)}" data-question="${esc(q.id)}" value="${esc(o)}" ${valeur === o ? "checked" : ""}>
          <span>${o}</span>
        </label>`).join("")}
    </div>`;
  } else {
    saisie = `<input class="champ__saisie" type="${q.type}" data-question="${esc(q.id)}" value="${esc(valeur || "")}">`;
  }

  return `<div class="question ${q.type === "textarea" ? "question--large" : ""}">
    <span class="champ__label">${esc(q.label)}</span>
    ${saisie}
  </div>`;
}

/* ---- Étape 5 : synthèse ------------------------------------------------- */

function etapeSynthese(r) {
  const s = r.synthese;
  const prenom = prenomOu(r);
  return `
  <div class="bloc bloc--legende no-print">
    <h2>Synthèse et projet de progression</h2>
    <p class="aide">Cette section constitue la conclusion du rapport. Le bouton « Proposer une trame » compose un premier jet à partir des notes saisies ; il reste entièrement modifiable.</p>
    <div class="barre-actions">
      <button class="btn btn--fantome" data-action="generer-synthese" data-id="${esc(r.id)}">Proposer une trame</button>
    </div>
  </div>

  <form class="bloc" id="form-synthese" data-id="${esc(r.id)}">
    <div class="champs champs--colonne">
      ${champTexte("pointsForts", "Points forts", s.pointsForts, 5, `Ce sur quoi ${prenom} peut s'appuyer dès aujourd'hui.`)}
      ${champTexte("axesProgression", "Axes de progression", s.axesProgression, 5, "Les priorités de travail pour les prochaines semaines.")}
      ${champTexte("objectifs", "Objectifs individualisés", s.objectifs, 5, "Objectifs concrets, mesurables et datés.")}
      ${champTexte("assiduite", "Assiduité et implication", s.assiduite, 3, "Présence, ponctualité, comportement à l'entraînement.")}
      ${champTexte("comportement", "Comportement dans le groupe", s.comportement, 3, "Vie collective, respect du cadre, relations avec l'encadrement.")}
      ${champTexte("conclusion", "Conclusion générale", s.conclusion, 6, "Appréciation globale adressée au stagiaire et à sa famille.")}
      ${champTexte("recommandation", "Recommandation du staff", s.recommandation, 4, "Orientation conseillée pour la suite du parcours.")}
    </div>
    <div class="barre-actions">
      <button class="btn" type="submit">Enregistrer la synthèse</button>
    </div>
  </form>`;
}

function genererSynthese(r) {
  const prenom = prenomOu(r);
  const items = tousLesItems().map(i => ({ ...i, n: r.notes[i.id] || {} }))
    .filter(i => typeof i.n.P === "number");

  if (!items.length) {
    toast("Renseignez d'abord quelques notes dans l'onglet Évaluation.", "erreur");
    return;
  }

  const score = i => {
    const v = [i.n.P];
    if (i.structure.double && typeof i.n.R === "number") v.push(i.n.R);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  const tries = [...items].sort((a, b) => score(b) - score(a));
  const forts = tries.filter(i => score(i) >= 4).slice(0, 5);
  const faibles = [...tries].reverse().filter(i => score(i) < 4).slice(0, 4);

  const moyG = moyenneGenerale(r.notes);
  const meilleure = [...STRUCTURES].map(s => ({ s, m: moyenneStructure(s, r.notes) }))
    .filter(x => x.m !== null).sort((a, b) => b.m - a.m)[0];
  const moindre = [...STRUCTURES].map(s => ({ s, m: moyenneStructure(s, r.notes) }))
    .filter(x => x.m !== null).sort((a, b) => a.m - b.m)[0];

  const liste = arr => arr.map(i => `• ${i.nom} (${i.structure.nom})`).join("\n");

  r.synthese.pointsForts = forts.length
    ? `${prenom} s'appuie sur des qualités solides, en particulier dans la structure ${meilleure.s.nom} (moyenne de ${formatNote(meilleure.m)}) :\n${liste(forts)}`
    : `${prenom} dispose de bases saines sur lesquelles construire la suite de sa progression.`;

  r.synthese.axesProgression = faibles.length
    ? `Les priorités de travail identifiées durant le stage concernent principalement la structure ${moindre.s.nom} (moyenne de ${formatNote(moindre.m)}) :\n${liste(faibles)}`
    : `Aucun axe de progression majeur n'est ressorti durant ce stage : le travail portera sur la consolidation de l'ensemble des acquis.`;

  r.synthese.objectifs = faibles.slice(0, 3)
    .map((i, k) => `${k + 1}. ${i.nom} — travailler ce point à raison de deux situations dédiées par semaine, et mesurer les progrès sur les quatre prochains matchs.`)
    .join("\n") || `1. Maintenir le niveau d'exigence atteint pendant le stage sur l'ensemble des séances de club.`;

  r.synthese.conclusion =
`${prenom} termine ce stage avec une moyenne générale de ${formatNote(moyG)} sur 5. Il s'est montré réceptif aux contenus proposés et a su tirer profit des situations de travail mises en place par le staff.
Sa structure la plus aboutie est ${meilleure.s.nom}, tandis que la structure ${moindre.s.nom} constitue aujourd'hui son principal levier de progression.
L'ensemble du staff encourage ${prenom} à poursuivre le travail engagé et reste à la disposition de la famille pour accompagner la suite de son parcours.`;

  r.synthese.recommandation = moyG >= 4
    ? `Le staff recommande d'exposer ${prenom} à un niveau de pratique plus exigeant afin de continuer à le confronter à des situations de jeu stimulantes.`
    : moyG >= 3
      ? `Le staff recommande de maintenir ${prenom} dans son environnement actuel, en accompagnant le travail identifié dans les axes de progression.`
      : `Le staff recommande un travail fondamental prioritaire sur les axes identifiés, avec un accompagnement individualisé régulier.`;

  if (!r.synthese.assiduite) r.synthese.assiduite = `${prenom} a été présent et ponctuel sur l'ensemble des séances du stage.`;
  if (!r.synthese.comportement) r.synthese.comportement = `${prenom} a respecté le cadre posé par l'encadrement et s'est bien intégré au groupe.`;

  enregistrerRapport(r);
  toast("Trame de synthèse générée. Relisez et ajustez le texte.");
  rendre();
}

/* ---- Étape 6 : rapport --------------------------------------------------- */

function etapeRapport(r, g) {
  return `
  <div class="bloc bloc--legende no-print">
    <h2>Rapport final</h2>
    <p class="aide">Vérifiez le document ci-dessous, puis lancez l'impression. Dans la fenêtre d'impression, choisissez <strong>« Enregistrer au format PDF »</strong> comme destination et activez les <strong>graphiques d'arrière-plan</strong> pour conserver les couleurs.</p>
    <div class="barre-actions">
      <button class="btn btn--grand" data-action="imprimer">Générer le PDF</button>
      <button class="btn btn--fantome" data-action="exporter-un" data-id="${esc(r.id)}">Exporter les données</button>
    </div>
  </div>
  <div id="apercu-rapport">${construireRapport(r, g)}</div>`;
}

/* =========================================================================
   ÉVÉNEMENTS
   ========================================================================= */

function majRapportDepuisFormulaire(cible) {
  const r = etat.rapport;
  if (!r) return;

  const form = cible.closest("#form-identite");
  if (form && cible.name) {
    r.identite[cible.name] = cible.value;
    enregistrerRapport(r);
    return;
  }
  const fs = cible.closest("#form-synthese");
  if (fs && cible.name) {
    r.synthese[cible.name] = cible.value;
    enregistrerRapport(r);
    return;
  }
  if (cible.dataset.commentaire) {
    const id = cible.dataset.commentaire;
    r.notes[id] = r.notes[id] || {};
    r.notes[id].commentaire = cible.value;
    enregistrerRapport(r);
    return;
  }
  if (cible.dataset.question) {
    const zone = cible.closest("#zone-questionnaire");
    if (!zone) return;
    r[zone.dataset.cle][cible.dataset.question] = cible.value;
    enregistrerRapport(r);
    if (cible.type === "radio") {
      zone.querySelectorAll(`input[data-question="${CSS.escape(cible.dataset.question)}"]`).forEach(inp => {
        inp.closest(".choix__opt").classList.toggle("choix__opt--actif", inp.checked);
      });
    }
  }
}

document.addEventListener("input", e => {
  const c = e.target;
  if (c.matches("textarea, input[type=text], input[type=date], input[type=tel], input[type=email]")) {
    clearTimeout(c._minuteur);
    c._minuteur = setTimeout(() => majRapportDepuisFormulaire(c), 400);
  }
});

document.addEventListener("change", e => {
  const c = e.target;
  if (c.matches("select, input[type=radio], input, textarea")) majRapportDepuisFormulaire(c);
});

document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "form-reglages") {
    const d = new FormData(f);
    ecrireReglages({
      structureNom: d.get("structureNom"), sousTitre: d.get("sousTitre"),
      signataire: d.get("signataire"), fonction: d.get("fonction"),
      colonnes: { P: d.get("colP") || "P", R: d.get("colR") || "R" },
      mentionFin: d.get("mentionFin")
    });
    toast("Réglages enregistrés.");
    return;
  }
  if (f.id === "form-identite" || f.id === "form-synthese") {
    f.querySelectorAll("[name]").forEach(c => majRapportDepuisFormulaire(c));
    toast("Enregistré.");
    rendre();
  }
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;

  if (action === "nouveau") {
    const r = nouveauRapport();
    enregistrerRapport(r);
    location.hash = `#/r/${r.id}/identite`;
    return;
  }

  if (action === "supprimer") {
    const r = lireRapport(b.dataset.id);
    if (!r) return;
    if (confirm(`Supprimer définitivement le rapport de ${nomComplet(r)} ?\nCette action est irréversible.`)) {
      supprimerRapport(b.dataset.id);
      toast("Rapport supprimé.");
      rendre();
    }
    return;
  }

  if (action === "dupliquer") {
    const copie = dupliquerRapport(b.dataset.id);
    if (copie) { toast("Rapport dupliqué."); rendre(); }
    return;
  }

  if (action === "exporter-tout") {
    telecharger(`machina-rapport-sauvegarde-${new Date().toISOString().slice(0,10)}.json`, exporterTout());
    return;
  }

  if (action === "exporter-un") {
    const r = lireRapport(b.dataset.id);
    const nom = nomComplet(r).replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase();
    telecharger(`machina-rapport-${nom || "stagiaire"}.json`, exporterRapport(b.dataset.id));
    return;
  }

  if (action === "importer") {
    document.getElementById("fichier-import").click();
    return;
  }

  if (action === "tout-effacer") {
    if (confirm("Effacer TOUS les rapports et réglages de ce navigateur ?\nExportez vos données avant de continuer. Cette action est irréversible.")) {
      localStorage.removeItem(CLE_RAPPORTS);
      localStorage.removeItem(CLE_REGLAGES);
      toast("Données effacées.");
      location.hash = "#/";
      rendre();
    }
    return;
  }

  if (action === "note") {
    const r = etat.rapport;
    const id = b.dataset.item, col = b.dataset.col, val = b.dataset.valeur;
    r.notes[id] = r.notes[id] || {};
    if (val === "") delete r.notes[id][col];
    else r.notes[id][col] = Number(val);
    enregistrerRapport(r);
    rendre();
    return;
  }

  if (action === "suggestion") {
    const r = etat.rapport;
    const id = b.dataset.item, niveau = Number(b.dataset.niveau);
    const item = tousLesItems().find(i => i.id === id);
    if (!item) return;
    const texte = item.phrases[niveau].replace(/\{prenom\}/g, prenomOu(r));
    const zone = document.querySelector(`[data-commentaire="${CSS.escape(id)}"]`);
    zone.value = texte;
    r.notes[id] = r.notes[id] || {};
    r.notes[id].commentaire = texte;
    enregistrerRapport(r);
    toast("Commentaire proposé — vous pouvez l'adapter.");
    return;
  }

  if (action === "generer-synthese") {
    genererSynthese(etat.rapport);
    return;
  }

  if (action === "imprimer") {
    window.print();
    return;
  }

  if (action === "imprimer-questionnaire") {
    imprimerQuestionnaireVierge(b.dataset.cle);
    return;
  }
});

document.addEventListener("change", e => {
  if (e.target.id !== "fichier-import") return;
  const fichier = e.target.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const n = importerJSON(lecteur.result);
      toast(`${n} rapport${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}.`);
      location.hash = "#/";
      rendre();
    } catch (err) {
      toast("Import impossible : " + err.message, "erreur");
    }
  };
  lecteur.readAsText(fichier);
  e.target.value = "";
});

/* ---- Impression d'un questionnaire vierge -------------------------------- */

function imprimerQuestionnaireVierge(cle) {
  const banque = cle === "joueur" ? QUESTIONNAIRE_JOUEUR : QUESTIONNAIRE_PARENTS;
  const g = lireReglages();
  const titre = cle === "joueur" ? "Questionnaire joueur" : "Questionnaire parents / responsables légaux";

  const sections = banque.map(s => `
    <section class="q-section">
      <h2>${esc(s.titre)}</h2>
      ${s.intro ? `<p class="q-intro">${esc(s.intro)}</p>` : ""}
      ${s.questions.map(q => {
        if (q.type === "echelle" || q.type === "select") {
          return `<div class="q-item"><p>${esc(q.label)}</p>
            <p class="q-opts">${q.options.map(o => `<span>☐ ${esc(o)}</span>`).join(" ")}</p></div>`;
        }
        if (q.type === "oui_non") {
          return `<div class="q-item"><p>${esc(q.label)}</p>
            <p class="q-opts"><span>☐ Oui</span> <span>☐ Non</span> <span>☐ Ne sait pas</span></p></div>`;
        }
        const lignes = q.type === "textarea" ? 3 : 1;
        return `<div class="q-item"><p>${esc(q.label)}</p>${"<span class='q-ligne'></span>".repeat(lignes)}</div>`;
      }).join("")}
    </section>`).join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>${esc(titre)} — ${esc(g.structureNom)}</title>
    <style>
      @page { size: A4; margin: 16mm 14mm; }
      body { font: 10.5pt/1.5 Georgia, "Times New Roman", serif; color: #111; }
      header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
      header h1 { font-size: 16pt; margin: 0 0 2px; }
      header p { margin: 0; font-size: 9pt; color: #555; letter-spacing: .08em; text-transform: uppercase; }
      .id-bloc { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 16px; font-size: 10pt; }
      .id-bloc div { border-bottom: 1px dotted #999; padding-bottom: 3px; }
      .q-section { break-inside: avoid-page; margin-bottom: 14px; }
      .q-section h2 { font-size: 11.5pt; background: #f0f0f0; padding: 4px 8px; margin: 0 0 6px; border-left: 3px solid #111; }
      .q-intro { font-size: 8.5pt; font-style: italic; color: #555; margin: 0 0 8px; }
      .q-item { margin-bottom: 9px; break-inside: avoid; }
      .q-item p { margin: 0 0 3px; }
      .q-opts span { display: inline-block; margin-right: 14px; font-size: 9.5pt; }
      .q-ligne { display: block; border-bottom: 1px dotted #aaa; height: 15px; }
      footer { margin-top: 18px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8.5pt; color: #555; }
    </style></head><body>
    <header>
      <h1>${esc(titre)}</h1>
      <p>${esc(g.structureNom)} — ${esc(g.sousTitre)}</p>
    </header>
    <div class="id-bloc">
      <div>Nom du stagiaire :</div><div>Prénom :</div>
      <div>Date de naissance :</div><div>Catégorie :</div>
      <div>Stage :</div><div>Date de l'entretien :</div>
    </div>
    ${sections}
    <footer>Document à conserver par la structure. Les informations recueillies sont utilisées aux seules fins d'établissement du rapport d'évaluation du stagiaire.</footer>
    </body></html>`;

  const f = window.open("", "_blank");
  if (!f) { toast("Autorisez les fenêtres surgissantes pour imprimer.", "erreur"); return; }
  f.document.write(html);
  f.document.close();
  f.focus();
  setTimeout(() => f.print(), 350);
}

/* ---- Démarrage ---------------------------------------------------------- */

window.addEventListener("hashchange", naviguer);
document.addEventListener("DOMContentLoaded", naviguer);
