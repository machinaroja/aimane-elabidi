/* =========================================================================
   MACHINA RAPPORT — Banques de questions
   Types de champ : text | textarea | date | tel | email | select | echelle | oui_non | multi
   ========================================================================= */

const ECHELLE_ACCORD = ["1 — Pas du tout", "2 — Un peu", "3 — Moyennement", "4 — Beaucoup", "5 — Totalement"];
const ECHELLE_FREQ   = ["1 — Jamais", "2 — Rarement", "3 — Parfois", "4 — Souvent", "5 — Toujours"];

/* =========================================================================
   QUESTIONNAIRE JOUEUR
   À conduire en entretien individuel, en début et en fin de stage.
   ========================================================================= */

const QUESTIONNAIRE_JOUEUR = [
  {
    id: "j_identite",
    titre: "1. Identité & parcours sportif",
    intro: "À renseigner avec le joueur lors de l'entretien d'accueil.",
    questions: [
      { id: "j_poste_principal",   type: "select",   label: "Quel est ton poste principal ?", options: ["Gardien", "Latéral droit", "Latéral gauche", "Défenseur central", "Milieu défensif", "Milieu relayeur", "Milieu offensif", "Ailier droit", "Ailier gauche", "Attaquant de pointe", "Polyvalent"] },
      { id: "j_poste_secondaire", type: "text",     label: "À quel autre poste peux-tu évoluer ?" },
      { id: "j_pied_fort",        type: "select",   label: "Quel est ton pied fort ?", options: ["Droit", "Gauche", "Ambidextre"] },
      { id: "j_annees_pratique",  type: "text",     label: "Depuis combien d'années joues-tu au football en club ?" },
      { id: "j_clubs",            type: "textarea", label: "Quels clubs as-tu fréquentés jusqu'à aujourd'hui ?" },
      { id: "j_volume",           type: "text",     label: "Combien de séances d'entraînement fais-tu par semaine, hors stage ?" },
      { id: "j_autres_sports",    type: "text",     label: "Pratiques-tu d'autres sports ? Lesquels et à quelle fréquence ?" },
      { id: "j_modele",           type: "text",     label: "Quel joueur professionnel prends-tu comme modèle, et pourquoi ?" },
      { id: "j_meilleur_souvenir",type: "textarea", label: "Quel est ton meilleur souvenir de football à ce jour ?" }
    ]
  },
  {
    id: "j_motivation",
    titre: "2. Motivation, objectifs & projet",
    intro: "Cette section éclaire l'engagement du joueur et sert de base au plan de progression.",
    questions: [
      { id: "j_pourquoi_stage",    type: "textarea", label: "Pourquoi as-tu voulu participer à ce stage ?" },
      { id: "j_attentes",          type: "textarea", label: "Qu'attends-tu concrètement de cette semaine ?" },
      { id: "j_objectif_stage",    type: "textarea", label: "Si tu ne devais retenir qu'un seul objectif pour ce stage, lequel serait-il ?" },
      { id: "j_plaisir",           type: "echelle",  label: "À quel point prends-tu du plaisir à jouer au football aujourd'hui ?", options: ECHELLE_ACCORD },
      { id: "j_ambition",          type: "textarea", label: "Où aimerais-tu en être dans trois ans, sur le plan sportif ?" },
      { id: "j_pret_sacrifices",   type: "echelle",  label: "Es-tu prêt à modifier ton hygiène de vie (sommeil, alimentation, écrans) pour progresser ?", options: ECHELLE_ACCORD },
      { id: "j_travail_perso",     type: "oui_non",  label: "Travailles-tu le football en dehors des entraînements du club ?" },
      { id: "j_travail_perso_quoi",type: "textarea", label: "Si oui, que fais-tu exactement et à quelle fréquence ?" }
    ]
  },
  {
    id: "j_coordination",
    titre: "3. Auto-évaluation — Coordination",
    intro: "Le joueur s'évalue sur les fondamentaux techniques. À comparer avec l'observation du staff.",
    structure: "coordination",
    questions: [
      { id: "j_auto_passes",     type: "echelle",  label: "Comment évalues-tu la qualité de tes passes ?", options: ECHELLE_ACCORD },
      { id: "j_auto_controles",  type: "echelle",  label: "Comment évalues-tu ta première touche de balle ?", options: ECHELLE_ACCORD },
      { id: "j_auto_conduite",   type: "echelle",  label: "Comment évalues-tu ta conduite de balle en course ?", options: ECHELLE_ACCORD },
      { id: "j_pied_faible",     type: "echelle",  label: "À quel point te sens-tu à l'aise avec ton pied faible ?", options: ECHELLE_ACCORD },
      { id: "j_geste_difficile", type: "textarea", label: "Quel geste technique te met le plus en difficulté aujourd'hui ?" }
    ]
  },
  {
    id: "j_cognitif",
    titre: "4. Auto-évaluation — Cognitif",
    intro: "Lecture du jeu et qualité des décisions telles que le joueur les perçoit.",
    structure: "cognitif",
    questions: [
      { id: "j_prise_info",     type: "echelle",  label: "Regardes-tu autour de toi avant de recevoir le ballon ?", options: ECHELLE_FREQ },
      { id: "j_role_terrain",   type: "textarea", label: "Peux-tu expliquer avec tes mots quel est ton rôle sur le terrain, avec et sans le ballon ?" },
      { id: "j_temps_faible",   type: "textarea", label: "Comment sais-tu qu'il faut ralentir le jeu plutôt que d'accélérer ?" },
      { id: "j_decision_rapide",type: "echelle",  label: "Te sens-tu capable de décider vite quand tu es sous pression ?", options: ECHELLE_ACCORD },
      { id: "j_apres_match",    type: "oui_non",  label: "Revois-tu tes matchs ou repenses-tu à tes actions après la rencontre ?" }
    ]
  },
  {
    id: "j_emotif",
    titre: "5. Auto-évaluation — Émotif / Volitif",
    intro: "Énergie, engagement et régulation émotionnelle.",
    structure: "emotif_volitif",
    questions: [
      { id: "j_envie_seance",   type: "echelle",  label: "Arrives-tu aux entraînements avec de l'envie ?", options: ECHELLE_FREQ },
      { id: "j_demande_ballon", type: "echelle",  label: "Demandes-tu le ballon dans les moments difficiles du match ?", options: ECHELLE_FREQ },
      { id: "j_avant_match",    type: "textarea", label: "Que ressens-tu dans l'heure qui précède un match important ?" },
      { id: "j_colere",         type: "echelle",  label: "T'arrive-t-il de t'énerver pendant un match ?", options: ECHELLE_FREQ },
      { id: "j_gestion_colere", type: "textarea", label: "Quand cela arrive, que fais-tu pour retrouver ton calme ?" },
      { id: "j_effort_defensif",type: "echelle",  label: "Fournis-tu autant d'efforts sans le ballon qu'avec le ballon ?", options: ECHELLE_ACCORD }
    ]
  },
  {
    id: "j_creatif",
    titre: "6. Auto-évaluation — Créatif / Expressif",
    intro: "Prise de risque, originalité et adaptabilité.",
    structure: "creatif_expressif",
    questions: [
      { id: "j_oser",         type: "echelle",  label: "Oses-tu tenter des choses nouvelles en match, même au risque de rater ?", options: ECHELLE_FREQ },
      { id: "j_peur_erreur",  type: "echelle",  label: "As-tu peur de faire une erreur quand tu prends une initiative ?", options: ECHELLE_ACCORD },
      { id: "j_solutions",    type: "textarea", label: "Quand une solution ne fonctionne pas, qu'essaies-tu ensuite ?" },
      { id: "j_changement",   type: "echelle",  label: "Te sens-tu à l'aise quand on te change de poste ou de système ?", options: ECHELLE_ACCORD },
      { id: "j_signature",    type: "textarea", label: "Quel geste ou quelle action te caractérise le mieux sur un terrain ?" }
    ]
  },
  {
    id: "j_mental",
    titre: "7. Auto-évaluation — Mental",
    intro: "Rapport au résultat, à l'erreur et à la pression extérieure.",
    structure: "mental",
    questions: [
      { id: "j_apres_erreur",   type: "textarea", label: "Que se passe-t-il dans ta tête juste après une erreur ?" },
      { id: "j_rebond",         type: "echelle",  label: "Arrives-tu à repartir immédiatement sur l'action suivante ?", options: ECHELLE_ACCORD },
      { id: "j_score_defavorable", type: "echelle", label: "Ton niveau de jeu reste-t-il le même quand ton équipe est menée ?", options: ECHELLE_ACCORD },
      { id: "j_erreur_partenaire", type: "textarea", label: "Comment réagis-tu quand un coéquipier commet une erreur ?" },
      { id: "j_public",         type: "echelle",  label: "Le public, l'arbitre ou les parents influencent-ils ton jeu ?", options: ECHELLE_ACCORD },
      { id: "j_pression",       type: "textarea", label: "Qu'est-ce qui te met le plus la pression aujourd'hui dans le football ?" }
    ]
  },
  {
    id: "j_socio",
    titre: "8. Auto-évaluation — Socio / Affectif",
    intro: "Relation aux autres et place dans le groupe.",
    structure: "socio_affectif",
    questions: [
      { id: "j_communication", type: "echelle",  label: "Parles-tu à tes coéquipiers pendant le match ?", options: ECHELLE_FREQ },
      { id: "j_integration",   type: "echelle",  label: "Te sens-tu bien intégré dans le groupe ?", options: ECHELLE_ACCORD },
      { id: "j_aide",          type: "textarea", label: "Comment aides-tu un coéquipier qui traverse un moment difficile ?" },
      { id: "j_leader",        type: "oui_non",  label: "Te considères-tu comme un leader dans ton équipe ?" },
      { id: "j_leader_pourquoi", type: "textarea", label: "Explique ta réponse en quelques mots." },
      { id: "j_critique",      type: "echelle",  label: "Acceptes-tu facilement les remarques de ton entraîneur ?", options: ECHELLE_ACCORD }
    ]
  },
  {
    id: "j_hygiene",
    titre: "9. Hygiène de vie & récupération",
    intro: "Facteurs déterminants de la progression et de la prévention des blessures.",
    questions: [
      { id: "j_sommeil_heures", type: "select",   label: "Combien d'heures dors-tu en moyenne par nuit ?", options: ["Moins de 7 h", "7 à 8 h", "8 à 9 h", "9 à 10 h", "Plus de 10 h"] },
      { id: "j_ecrans",         type: "select",   label: "Combien de temps passes-tu devant les écrans chaque jour ?", options: ["Moins de 1 h", "1 à 2 h", "2 à 4 h", "4 à 6 h", "Plus de 6 h"] },
      { id: "j_petit_dejeuner", type: "oui_non",  label: "Prends-tu un petit-déjeuner tous les matins ?" },
      { id: "j_hydratation",    type: "echelle",  label: "Penses-tu à boire régulièrement pendant l'effort ?", options: ECHELLE_FREQ },
      { id: "j_etirements",     type: "echelle",  label: "Fais-tu des étirements ou de la récupération après les séances ?", options: ECHELLE_FREQ },
      { id: "j_douleurs",       type: "textarea", label: "As-tu des douleurs récurrentes ? Où et depuis quand ?" }
    ]
  },
  {
    id: "j_bilan",
    titre: "10. Retour du joueur sur le stage",
    intro: "À compléter lors de l'entretien de fin de stage.",
    questions: [
      { id: "j_bilan_progres",  type: "textarea", label: "Sur quoi as-tu le sentiment d'avoir progressé cette semaine ?" },
      { id: "j_bilan_difficile",type: "textarea", label: "Quel a été le moment le plus difficile du stage pour toi ?" },
      { id: "j_bilan_apprentissage", type: "textarea", label: "Quelle est la chose la plus importante que tu retiens ?" },
      { id: "j_bilan_note",     type: "echelle",  label: "Quelle note globale donnes-tu à ce stage ?", options: ["1 — Décevant", "2 — Moyen", "3 — Satisfaisant", "4 — Très bon", "5 — Excellent"] },
      { id: "j_bilan_suite",    type: "textarea", label: "Que vas-tu continuer à travailler seul en rentrant chez toi ?" },
      { id: "j_bilan_libre",    type: "textarea", label: "Souhaites-tu ajouter quelque chose que nous n'avons pas abordé ?" }
    ]
  }
];

/* =========================================================================
   QUESTIONNAIRE PARENTS / RESPONSABLES LÉGAUX
   À transmettre avant le stage, puis compléter par un échange en fin de stage.
   ========================================================================= */

const QUESTIONNAIRE_PARENTS = [
  {
    id: "p_identite",
    titre: "1. Identité & contacts",
    intro: "Informations administratives nécessaires à l'accueil du stagiaire.",
    questions: [
      { id: "p_nom_responsable", type: "text",   label: "Nom et prénom du responsable légal renseignant ce questionnaire" },
      { id: "p_lien",            type: "select", label: "Lien avec le stagiaire", options: ["Mère", "Père", "Tuteur / Tutrice", "Autre représentant légal"] },
      { id: "p_tel1",            type: "tel",    label: "Téléphone principal" },
      { id: "p_tel2",            type: "tel",    label: "Téléphone secondaire (second parent ou proche)" },
      { id: "p_email",           type: "email",  label: "Adresse e-mail pour l'envoi du rapport" },
      { id: "p_adresse",         type: "textarea", label: "Adresse postale complète" },
      { id: "p_urgence",         type: "text",   label: "Personne à prévenir en cas d'urgence (nom et téléphone) si différente" }
    ]
  },
  {
    id: "p_environnement",
    titre: "2. Environnement familial & scolarité",
    intro: "Le contexte de vie éclaire la lecture du comportement observé pendant le stage.",
    questions: [
      { id: "p_fratrie",        type: "text",     label: "Le stagiaire a-t-il des frères et sœurs ? Précisez leurs âges." },
      { id: "p_sport_famille",  type: "oui_non",  label: "D'autres membres de la famille pratiquent-ils un sport en compétition ?" },
      { id: "p_niveau_scolaire",type: "select",   label: "Classe actuelle", options: ["CM1", "CM2", "6e", "5e", "4e", "3e", "2nde", "1re", "Terminale", "Autre"] },
      { id: "p_resultats",      type: "select",   label: "Comment situez-vous ses résultats scolaires ?", options: ["En difficulté", "Fragiles", "Satisfaisants", "Bons", "Très bons"] },
      { id: "p_amenagement",    type: "oui_non",  label: "Bénéficie-t-il d'un aménagement scolaire, d'un PAI ou d'un accompagnement particulier ?" },
      { id: "p_amenagement_detail", type: "textarea", label: "Si oui, merci de préciser." },
      { id: "p_equilibre",      type: "echelle",  label: "L'équilibre entre scolarité et football vous semble-t-il maîtrisé ?", options: ECHELLE_ACCORD }
    ]
  },
  {
    id: "p_sante",
    titre: "3. Santé, croissance & sécurité",
    intro: "Section indispensable à la sécurité du stagiaire pendant la durée du stage.",
    questions: [
      { id: "p_certificat",     type: "oui_non",  label: "Le certificat médical de non contre-indication est-il fourni et à jour ?" },
      { id: "p_allergies",      type: "textarea", label: "Allergies connues (alimentaires, médicamenteuses, environnementales) et conduite à tenir" },
      { id: "p_traitement",     type: "textarea", label: "Traitement médical en cours (nom, posologie, horaires de prise)" },
      { id: "p_asthme",         type: "oui_non",  label: "Asthme, diabète, épilepsie ou autre pathologie chronique ?" },
      { id: "p_asthme_detail",  type: "textarea", label: "Si oui, merci de détailler et d'indiquer le protocole d'urgence." },
      { id: "p_blessures",      type: "textarea", label: "Blessures survenues au cours des douze derniers mois (nature, durée d'arrêt)" },
      { id: "p_douleurs",       type: "textarea", label: "Douleurs récurrentes signalées par l'enfant (genoux, talons, dos…)" },
      { id: "p_croissance",     type: "oui_non",  label: "Une poussée de croissance rapide a-t-elle été observée récemment ?" },
      { id: "p_regime",         type: "textarea", label: "Régime alimentaire particulier ou aliments à proscrire" },
      { id: "p_vaccins",        type: "oui_non",  label: "Les vaccinations obligatoires sont-elles à jour ?" }
    ]
  },
  {
    id: "p_parcours",
    titre: "4. Parcours sportif & encadrement",
    intro: "Historique de la pratique et regard porté sur l'encadrement actuel.",
    questions: [
      { id: "p_club_actuel",    type: "text",     label: "Club actuel et catégorie d'engagement" },
      { id: "p_anciennete",     type: "text",     label: "Depuis combien d'années pratique-t-il en club ?" },
      { id: "p_temps_jeu",      type: "select",   label: "Quel est son temps de jeu habituel en match ?", options: ["Très faible", "Faible", "Moyen", "Important", "Titulaire indiscutable"] },
      { id: "p_detections",     type: "textarea", label: "A-t-il déjà participé à des détections, tests ou sélections ? Avec quels résultats ?" },
      { id: "p_autres_stages",  type: "textarea", label: "A-t-il déjà effectué d'autres stages de football ? Lesquels ?" },
      { id: "p_relation_coach", type: "echelle",  label: "Comment qualifieriez-vous sa relation avec son entraîneur de club ?", options: ["1 — Très difficile", "2 — Tendue", "3 — Correcte", "4 — Bonne", "5 — Excellente"] }
    ]
  },
  {
    id: "p_comportement",
    titre: "5. Comportement & autonomie au quotidien",
    intro: "Regard parental sur les habitudes et le degré d'autonomie du stagiaire.",
    questions: [
      { id: "p_autonomie",      type: "echelle",  label: "Est-il autonome dans la préparation de son sac et de ses affaires ?", options: ECHELLE_ACCORD },
      { id: "p_ponctualite",    type: "echelle",  label: "Est-il ponctuel et organisé dans ses activités ?", options: ECHELLE_FREQ },
      { id: "p_sommeil",        type: "select",   label: "Combien d'heures dort-il en moyenne par nuit ?", options: ["Moins de 7 h", "7 à 8 h", "8 à 9 h", "9 à 10 h", "Plus de 10 h"] },
      { id: "p_ecrans",         type: "select",   label: "Temps d'écran quotidien estimé", options: ["Moins de 1 h", "1 à 2 h", "2 à 4 h", "4 à 6 h", "Plus de 6 h"] },
      { id: "p_alimentation",   type: "echelle",  label: "Son alimentation vous semble-t-elle équilibrée ?", options: ECHELLE_ACCORD },
      { id: "p_collectif",      type: "echelle",  label: "Se sent-il à l'aise dans un groupe qu'il ne connaît pas ?", options: ECHELLE_ACCORD },
      { id: "p_consignes",      type: "echelle",  label: "Accepte-t-il facilement le cadre et les consignes des adultes ?", options: ECHELLE_ACCORD }
    ]
  },
  {
    id: "p_mental",
    titre: "6. Émotions, mental & rapport à la pression",
    intro: "Éléments utiles à l'accompagnement individualisé du stagiaire.",
    questions: [
      { id: "p_defaite",        type: "textarea", label: "Comment réagit-il après une défaite ou une contre-performance ?" },
      { id: "p_confiance",      type: "echelle",  label: "Comment évaluez-vous sa confiance en lui dans le domaine sportif ?", options: ECHELLE_ACCORD },
      { id: "p_emotions",       type: "textarea", label: "Exprime-t-il facilement ce qu'il ressent ? De quelle manière ?" },
      { id: "p_pression",       type: "textarea", label: "Selon vous, qu'est-ce qui lui met le plus de pression aujourd'hui ?" },
      { id: "p_role_parent",    type: "textarea", label: "Quel rôle estimez-vous jouer dans sa pratique sportive ?" },
      { id: "p_bord_terrain",   type: "echelle",  label: "Selon vous, votre présence au bord du terrain l'aide-t-elle à mieux jouer ?", options: ECHELLE_ACCORD }
    ]
  },
  {
    id: "p_attentes",
    titre: "7. Attentes & projet sportif",
    intro: "Cadrage indispensable pour aligner le travail du staff et les attentes familiales.",
    questions: [
      { id: "p_motivation_inscription", type: "textarea", label: "Pourquoi avez-vous inscrit votre enfant à ce stage ?" },
      { id: "p_attentes_precises",      type: "textarea", label: "Qu'attendez-vous précisément de cette semaine ?" },
      { id: "p_points_forts",           type: "textarea", label: "Selon vous, quels sont ses trois principaux points forts ?" },
      { id: "p_axes",                   type: "textarea", label: "Selon vous, quels sont ses trois principaux axes de progression ?" },
      { id: "p_projet",                 type: "select",   label: "Quel est votre projet à moyen terme pour lui ?", options: ["Pratique loisir et plaisir", "Progresser dans son club actuel", "Rejoindre un club de niveau supérieur", "Intégrer une section sportive ou un pôle", "Viser le monde professionnel", "Aucun projet défini à ce jour"] },
      { id: "p_souhait_staff",          type: "textarea", label: "Y a-t-il un point que vous souhaitez que le staff observe en particulier ?" }
    ]
  },
  {
    id: "p_logistique",
    titre: "8. Logistique & disponibilité",
    intro: "Organisation pratique de la semaine de stage.",
    questions: [
      { id: "p_transport",     type: "select",   label: "Mode de transport prévu", options: ["Accompagné par la famille", "Transport en commun", "Covoiturage", "Navette du club", "Autre"] },
      { id: "p_repas",         type: "select",   label: "Formule de restauration", options: ["Repas fourni par la structure", "Panier repas apporté", "Retour au domicile le midi"] },
      { id: "p_horaires",      type: "textarea", label: "Contraintes horaires particulières sur la semaine" },
      { id: "p_absences",      type: "textarea", label: "Absences prévues pendant le stage (dates et motifs)" },
      { id: "p_equipement",    type: "oui_non",  label: "Le stagiaire dispose-t-il de l'équipement complet demandé ?" }
    ]
  },
  {
    id: "p_bilan",
    titre: "9. Retour des parents sur le stage",
    intro: "À compléter lors de l'entretien de restitution en fin de stage.",
    questions: [
      { id: "p_bilan_satisfaction", type: "echelle",  label: "Quel est votre niveau de satisfaction global concernant le stage ?", options: ["1 — Insatisfait", "2 — Peu satisfait", "3 — Satisfait", "4 — Très satisfait", "5 — Pleinement satisfait"] },
      { id: "p_bilan_enfant",       type: "textarea", label: "Qu'est-ce que votre enfant vous a rapporté de cette semaine ?" },
      { id: "p_bilan_evolution",    type: "textarea", label: "Avez-vous observé une évolution dans son comportement ou sa motivation ?" },
      { id: "p_bilan_encadrement",  type: "echelle",  label: "Comment évaluez-vous la qualité de l'encadrement ?", options: ["1 — Insuffisante", "2 — Perfectible", "3 — Correcte", "4 — Bonne", "5 — Excellente"] },
      { id: "p_bilan_amelioration", type: "textarea", label: "Que pourrions-nous améliorer pour les prochains stages ?" },
      { id: "p_bilan_recommander",  type: "oui_non",  label: "Recommanderiez-vous ce stage à d'autres familles ?" }
    ]
  },
  {
    id: "p_autorisations",
    titre: "10. Autorisations & consentements",
    intro: "Mentions à recueillir avant le début du stage.",
    questions: [
      { id: "p_droit_image",   type: "oui_non",  label: "J'autorise la captation et la diffusion de l'image de mon enfant dans le cadre de la communication de la structure." },
      { id: "p_soins",         type: "oui_non",  label: "J'autorise le responsable du stage à faire pratiquer les soins ou l'intervention médicale d'urgence rendus nécessaires par l'état de mon enfant." },
      { id: "p_donnees",       type: "oui_non",  label: "J'accepte le traitement des données renseignées aux seules fins d'établissement du rapport d'évaluation et de suivi du stagiaire." },
      { id: "p_transmission",  type: "oui_non",  label: "J'autorise la transmission du présent rapport au club d'appartenance de mon enfant, sur demande de celui-ci." },
      { id: "p_observations",  type: "textarea", label: "Observations complémentaires ou réserves éventuelles" }
    ]
  }
];

/* ---- Utilitaires ------------------------------------------------------ */

function compterQuestions(banque) {
  return banque.reduce((total, section) => total + section.questions.length, 0);
}

function reponsesRemplies(banque, reponses) {
  let n = 0;
  banque.forEach(section => section.questions.forEach(q => {
    const v = reponses[q.id];
    if (v !== undefined && v !== null && String(v).trim() !== "") n++;
  }));
  return n;
}
