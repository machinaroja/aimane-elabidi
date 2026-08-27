/* =========================================================================
   MACHINA RAPPORT — Persistance locale (localStorage)
   Aucune donnée n'est transmise à un serveur : tout reste sur le poste.
   ========================================================================= */

const CLE_RAPPORTS = "machina.rapports.v1";
const CLE_REGLAGES = "machina.reglages.v1";

const REGLAGES_DEFAUT = {
  structureNom: "Machina",
  sousTitre: "Rapport d'évaluation de stage",
  colonnes: { ...COLONNES_DEFAUT },
  signataire: "",
  fonction: "Responsable technique",
  mentionFin: "Ce rapport est établi à l'issue du stage à partir des observations du staff technique, de l'entretien mené avec le stagiaire et des éléments transmis par la famille."
};

function uid() {
  return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nouveauRapport() {
  return {
    id: uid(),
    creeLe: new Date().toISOString(),
    majLe: new Date().toISOString(),
    statut: "brouillon",
    identite: {
      prenom: "", nom: "", naissance: "", poste: "", piedFort: "",
      clubOrigine: "", categorie: "", numero: "",
      stageIntitule: "", stageDu: "", stageAu: "", lieu: "",
      evaluateur: "", groupe: ""
    },
    notes: {},        // { itemId: { P: n, R: n, commentaire: "" } }
    joueur: {},       // réponses questionnaire joueur
    parents: {},      // réponses questionnaire parents
    synthese: {
      pointsForts: "", axesProgression: "", objectifs: "",
      assiduite: "", comportement: "", conclusion: "", recommandation: ""
    }
  };
}

function lireRapports() {
  try {
    const brut = localStorage.getItem(CLE_RAPPORTS);
    if (!brut) return [];
    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    console.error("Lecture des rapports impossible", e);
    return [];
  }
}

function ecrireRapports(liste) {
  try {
    localStorage.setItem(CLE_RAPPORTS, JSON.stringify(liste));
    return true;
  } catch (e) {
    alert("Enregistrement impossible : espace de stockage du navigateur saturé.");
    return false;
  }
}

function lireRapport(id) {
  return lireRapports().find(r => r.id === id) || null;
}

function enregistrerRapport(rapport) {
  rapport.majLe = new Date().toISOString();
  const liste = lireRapports();
  const i = liste.findIndex(r => r.id === rapport.id);
  if (i >= 0) liste[i] = rapport; else liste.unshift(rapport);
  return ecrireRapports(liste);
}

function supprimerRapport(id) {
  return ecrireRapports(lireRapports().filter(r => r.id !== id));
}

function dupliquerRapport(id) {
  const source = lireRapport(id);
  if (!source) return null;
  const copie = JSON.parse(JSON.stringify(source));
  copie.id = uid();
  copie.creeLe = new Date().toISOString();
  copie.statut = "brouillon";
  copie.identite.prenom = source.identite.prenom;
  copie.identite.nom = source.identite.nom ? source.identite.nom + " (copie)" : "(copie)";
  enregistrerRapport(copie);
  return copie;
}

function lireReglages() {
  try {
    const brut = localStorage.getItem(CLE_REGLAGES);
    if (!brut) return { ...REGLAGES_DEFAUT };
    return { ...REGLAGES_DEFAUT, ...JSON.parse(brut) };
  } catch (e) {
    return { ...REGLAGES_DEFAUT };
  }
}

function ecrireReglages(reglages) {
  localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
}

/* ---- Import / export -------------------------------------------------- */

function exporterTout() {
  return JSON.stringify({
    application: "Machina Rapport",
    version: 1,
    exporteLe: new Date().toISOString(),
    reglages: lireReglages(),
    rapports: lireRapports()
  }, null, 2);
}

function exporterRapport(id) {
  const r = lireRapport(id);
  if (!r) return null;
  return JSON.stringify({
    application: "Machina Rapport", version: 1,
    exporteLe: new Date().toISOString(),
    reglages: lireReglages(), rapports: [r]
  }, null, 2);
}

/** Fusionne un export dans la base locale. Retourne le nombre de rapports ajoutés. */
function importerJSON(texte) {
  const donnees = JSON.parse(texte);
  if (!donnees || !Array.isArray(donnees.rapports)) {
    throw new Error("Fichier invalide : aucun rapport trouvé.");
  }
  const liste = lireRapports();
  const idsExistants = new Set(liste.map(r => r.id));
  let ajoutes = 0;
  donnees.rapports.forEach(r => {
    if (!r || typeof r !== "object") return;
    const copie = { ...nouveauRapport(), ...r };
    if (idsExistants.has(copie.id)) copie.id = uid();
    liste.unshift(copie);
    idsExistants.add(copie.id);
    ajoutes++;
  });
  ecrireRapports(liste);
  return ajoutes;
}

function telecharger(nomFichier, contenu, type = "application/json") {
  const blob = new Blob([contenu], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
