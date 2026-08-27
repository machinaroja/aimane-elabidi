/* =========================================================================
   MACHINA RAPPORT — Construction du document imprimable
   ========================================================================= */

function construireRapport(r, g) {
  return `
  <article class="doc">
    ${docCouverture(r, g)}
    ${docTableau(r, g)}
    ${docProfil(r)}
    ${docStructures(r)}
    ${docParoleJoueur(r)}
    ${docRegardFamille(r)}
    ${docSynthese(r, g)}
  </article>`;
}

/* ---- Bloc 1 : couverture et fiche stagiaire ----------------------------- */

function docCouverture(r, g) {
  const i = r.identite;
  const periode = i.stageDu && i.stageAu
    ? `Du ${dateFR(i.stageDu)} au ${dateFR(i.stageAu)}`
    : (i.stageDu ? dateFR(i.stageDu) : "Période non renseignée");

  const ligne = (label, valeur) =>
    `<div class="fiche__ligne"><dt>${esc(label)}</dt><dd>${esc(valeur || "—")}</dd></div>`;

  return `
  <section class="doc-page doc-page--garde">
    <header class="doc-entete">
      <div class="doc-entete__marque">
        <div class="doc-logo">MR</div>
        <div>
          <p class="doc-structure">${esc(g.structureNom)}</p>
          <p class="doc-soustitre">${esc(g.sousTitre)}</p>
        </div>
      </div>
      <p class="doc-date">Édité le ${dateFR(new Date().toISOString())}</p>
    </header>

    <div class="doc-titre">
      <h1>Rapport Machina de ${esc(nomComplet(r))}</h1>
      <p>${esc(i.stageIntitule || "Stage de perfectionnement")} · ${esc(periode)}</p>
    </div>

    <dl class="fiche">
      ${ligne("Prénom", i.prenom)}
      ${ligne("Nom", i.nom)}
      ${ligne("Date de naissance", i.naissance ? dateFR(i.naissance) : "")}
      ${ligne("Catégorie", i.categorie)}
      ${ligne("Poste principal", i.poste)}
      ${ligne("Pied fort", i.piedFort)}
      ${ligne("Club d'origine", i.clubOrigine)}
      ${ligne("Numéro", i.numero)}
      ${ligne("Lieu du stage", i.lieu)}
      ${ligne("Groupe", i.groupe)}
      ${ligne("Évaluateur référent", i.evaluateur)}
      ${ligne("Période", periode)}
    </dl>

    <div class="doc-methode">
      <h2>Méthode d'évaluation</h2>
      <p>Le stagiaire est observé sur <strong>${STRUCTURES.length} structures</strong> regroupant <strong>${tousLesItems().length} critères</strong>.
      Chaque critère est noté de 1 à 5 sur deux colonnes — <strong>${esc(g.colonnes.P)}</strong> et <strong>${esc(g.colonnes.R)}</strong> —
      à l'exception de la structure Coordination, évaluée sur une note unique.
      La valeur d'une structure correspond à la moyenne de ses notes, arrondie au dixième supérieur.</p>
      <ul class="doc-echelle">
        ${ECHELLE.map(e => `<li><span class="doc-echelle__n">${e.note}</span><strong>${esc(e.libelle)}</strong> — ${esc(e.desc)}</li>`).join("")}
      </ul>
    </div>
  </section>`;
}

/* ---- Bloc 2 : tableau structures / valeurs ------------------------------ */

function docTableau(r, g) {
  const maxLignes = Math.max(...STRUCTURES.map(s => s.items.length));

  const enteteStructures = STRUCTURES.map(s =>
    `<th class="tbl__struct" colspan="${s.double ? 3 : 2}" style="--couleur:${s.couleur}">${esc(s.nom)}</th>`).join("");

  const enteteValeurs = STRUCTURES.map(s => {
    const m = moyenneStructure(s, r.notes);
    return `<td class="tbl__valeur" colspan="${s.double ? 3 : 2}" style="--couleur:${s.couleur}">${m === null ? "—" : formatNote(m)}</td>`;
  }).join("");

  const enteteColonnes = STRUCTURES.map(s =>
    `<th class="tbl__critere-h">Critère</th>` +
    `<th class="tbl__pr">${esc(s.double ? g.colonnes.P.charAt(0).toUpperCase() : "N")}</th>` +
    (s.double ? `<th class="tbl__pr">${esc(g.colonnes.R.charAt(0).toUpperCase())}</th>` : "")
  ).join("");

  let lignes = "";
  for (let k = 0; k < maxLignes; k++) {
    lignes += "<tr>" + STRUCTURES.map(s => {
      const it = s.items[k];
      if (!it) return `<td class="tbl__vide"></td><td class="tbl__vide"></td>${s.double ? '<td class="tbl__vide"></td>' : ""}`;
      const n = r.notes[it.id] || {};
      const cell = v => `<td class="tbl__note">${typeof v === "number" ? v : "—"}</td>`;
      return `<td class="tbl__critere" style="--couleur:${s.couleur}">${esc(it.nom)}</td>${cell(n.P)}${s.double ? cell(n.R) : ""}`;
    }).join("") + "</tr>";
  }

  const moyG = moyenneGenerale(r.notes);

  return `
  <section class="doc-page">
    <h2 class="doc-h2">Tableau de synthèse — structures et valeurs</h2>
    <div class="tbl-enveloppe">
      <table class="tbl">
        <thead>
          <tr class="tbl__r-struct">${enteteStructures}</tr>
          <tr class="tbl__r-valeur">${enteteValeurs}</tr>
          <tr class="tbl__r-col">${enteteColonnes}</tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    <p class="tbl__legende">
      <strong>${esc(g.colonnes.P)}</strong> et <strong>${esc(g.colonnes.R)}</strong> : les deux colonnes de notation, de 1 à 5.
      La ligne colorée indique la valeur de chaque structure.
      ${moyG !== null ? `<span class="tbl__moyenne">Moyenne générale : <strong>${formatNote(moyG)} / 5</strong></span>` : ""}
    </p>
  </section>`;
}

/* ---- Bloc 3 : profil visuel --------------------------------------------- */

function docProfil(r) {
  const donnees = STRUCTURES.map(s => ({ s, m: moyenneStructure(s, r.notes) }));
  if (donnees.every(d => d.m === null)) return "";

  const barres = donnees.map(({ s, m }) => `
    <div class="profil__ligne">
      <span class="profil__nom">${esc(s.nom)}</span>
      <div class="profil__piste">
        <span class="profil__barre" style="width:${m === null ? 0 : (m / 5) * 100}%; background:${s.couleur}"></span>
      </div>
      <span class="profil__val" style="color:${s.couleur}">${m === null ? "—" : formatNote(m)}</span>
    </div>`).join("");

  return `
  <section class="doc-page doc-page--profil">
    <h2 class="doc-h2">Profil du stagiaire</h2>
    <div class="profil">
      <div class="profil__reperes">
        ${[1,2,3,4,5].map(n => `<span>${n}</span>`).join("")}
      </div>
      ${barres}
    </div>
  </section>`;
}

/* ---- Bloc 4 : détail par structure -------------------------------------- */

function docStructures(r) {
  const sections = STRUCTURES.map(s => {
    const m = moyenneStructure(s, r.notes);
    const items = s.items.map(it => {
      const n = r.notes[it.id] || {};
      const noteAffichee = s.double
        ? `${typeof n.P === "number" ? n.P : "—"} / ${typeof n.R === "number" ? n.R : "—"}`
        : `${typeof n.P === "number" ? n.P : "—"}`;
      const commentaire = (n.commentaire || "").trim();
      if (!commentaire && typeof n.P !== "number") return "";
      return `
      <div class="detail">
        <div class="detail__tete">
          <h4>${esc(it.nom.toUpperCase())}</h4>
          <span class="detail__note">${esc(noteAffichee)}</span>
        </div>
        <p class="detail__texte">${commentaire ? nl2br(commentaire) : `<em class="detail__absent">Aucun commentaire saisi pour ce critère.</em>`}</p>
      </div>`;
    }).join("");

    if (!items.trim()) return "";

    return `
    <section class="doc-bloc-struct" style="--couleur:${s.couleur}">
      <header class="doc-bloc-struct__tete">
        <h3>${esc(s.nom)}</h3>
        <span class="doc-bloc-struct__moy">${m === null ? "—" : formatNote(m)}</span>
      </header>
      <p class="doc-bloc-struct__resume">${esc(s.resume)}</p>
      ${items}
    </section>`;
  }).join("");

  if (!sections.trim()) return "";

  return `
  <section class="doc-page">
    <h2 class="doc-h2">Analyse détaillée par structure</h2>
    ${sections}
  </section>`;
}

/* ---- Bloc 5 : parole du joueur ------------------------------------------ */

function docParoleJoueur(r) {
  const contenu = rendreReponses(QUESTIONNAIRE_JOUEUR, r.joueur);
  if (!contenu) return "";
  return `
  <section class="doc-page">
    <h2 class="doc-h2">Parole du joueur</h2>
    <p class="doc-chapeau">Éléments recueillis lors de l'entretien individuel mené avec ${esc(prenomOu(r, "le stagiaire"))}.</p>
    ${contenu}
  </section>`;
}

/* ---- Bloc 6 : regard de la famille -------------------------------------- */

function docRegardFamille(r) {
  const contenu = rendreReponses(QUESTIONNAIRE_PARENTS, r.parents);
  if (!contenu) return "";
  return `
  <section class="doc-page">
    <h2 class="doc-h2">Regard de la famille</h2>
    <p class="doc-chapeau">Éléments transmis par le responsable légal, complétés lors de l'entretien de restitution.</p>
    ${contenu}
  </section>`;
}

function rendreReponses(banque, reponses) {
  const sections = banque.map(section => {
    const lignes = section.questions
      .filter(q => { const v = reponses[q.id]; return v !== undefined && v !== null && String(v).trim() !== ""; })
      .map(q => `<div class="rep"><dt>${esc(q.label)}</dt><dd>${nl2br(reponses[q.id])}</dd></div>`)
      .join("");
    if (!lignes) return "";
    const s = section.structure ? trouverStructure(section.structure) : null;
    return `<div class="rep-section" ${s ? `style="--couleur:${s.couleur}"` : ""}>
      <h3>${esc(section.titre)}</h3>
      <dl class="rep-liste">${lignes}</dl>
    </div>`;
  }).join("");
  return sections.trim() ? sections : "";
}

/* ---- Bloc 7 : synthèse et signature ------------------------------------- */

function docSynthese(r, g) {
  const s = r.synthese;
  const bloc = (titre, texte, modificateur = "") => {
    if (!(texte || "").trim()) return "";
    return `<div class="synth ${modificateur}">
      <h3>${esc(titre)}</h3>
      <p>${nl2br(texte)}</p>
    </div>`;
  };

  const corps = [
    bloc("Points forts", s.pointsForts, "synth--fort"),
    bloc("Axes de progression", s.axesProgression, "synth--axe"),
    bloc("Objectifs individualisés", s.objectifs, "synth--obj"),
    bloc("Assiduité et implication", s.assiduite),
    bloc("Comportement dans le groupe", s.comportement),
    bloc("Conclusion générale", s.conclusion),
    bloc("Recommandation du staff", s.recommandation, "synth--reco")
  ].join("");

  if (!corps.trim()) return "";

  return `
  <section class="doc-page">
    <h2 class="doc-h2">Synthèse et projet de progression</h2>
    ${corps}
    <div class="doc-pied">
      <p class="doc-mention">${esc(g.mentionFin)}</p>
      <div class="doc-signature">
        <div class="doc-signature__gauche">
          <p class="doc-signature__label">Fait à ${esc(r.identite.lieu || "…………………………")},</p>
          <p class="doc-signature__label">le ${dateFR(new Date().toISOString())}</p>
        </div>
        <div class="doc-signature__droite">
          <p class="doc-signature__fonction">${esc(g.fonction)}</p>
          <p class="doc-signature__nom">${esc(g.signataire || "…………………………")}</p>
          <div class="doc-signature__trait"></div>
          <p class="doc-signature__mention">Signature et cachet de la structure</p>
        </div>
      </div>
    </div>
  </section>`;
}
