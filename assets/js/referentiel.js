/* =========================================================================
   MACHINA RAPPORT — Référentiel d'évaluation
   6 structures · 20 items · notation P / R de 1 à 5
   ========================================================================= */

const ECHELLE = [
  { note: 1, libelle: "À construire",            court: "1", desc: "Compétence non encore installée. Nécessite un travail fondamental et un accompagnement rapproché." },
  { note: 2, libelle: "En développement",        court: "2", desc: "Compétence émergente, encore irrégulière. Apparaît dans les situations simples uniquement." },
  { note: 3, libelle: "Conforme au niveau",      court: "3", desc: "Compétence acquise et fiable dans le contexte habituel de jeu. Correspond aux attentes de la catégorie." },
  { note: 4, libelle: "Point d'appui",           court: "4", desc: "Compétence solide, mobilisée sous contrainte. Constitue une force sur laquelle le joueur peut s'appuyer." },
  { note: 5, libelle: "Point fort majeur",       court: "5", desc: "Compétence remarquable et différenciante, exprimée avec constance y compris dans les moments décisifs." }
];

/* P = Potentiel observé · R = Rendement en situation.
   Ces deux libellés sont modifiables dans Réglages. */
const COLONNES_DEFAUT = { P: "Potentiel", R: "Rendement" };

const STRUCTURES = [
  {
    id: "coordination",
    nom: "Coordination",
    couleur: "#2563eb",
    double: false,
    resume: "Maîtrise technique du ballon et qualité d'exécution des gestes fondamentaux sous contrainte de temps et d'espace.",
    items: [
      {
        id: "passes",
        nom: "Passes",
        definition: "Qualité, dosage, timing et variété du jeu de transmission, des deux pieds, sur courte et longue distance.",
        phrases: {
          1: "{prenom} doit consolider les fondamentaux de la transmission : surface de contact, dosage et orientation du corps. Un travail analytique régulier lui permettra de gagner en fiabilité.",
          2: "{prenom} transmet correctement dans les situations calmes, mais perd en précision dès que le rythme s'élève. Le travail sous pression sera la clé de sa progression.",
          3: "{prenom} dispose d'une qualité de passe fiable, adaptée aux exigences de sa catégorie. En développant son pied faible, il gagnera encore en polyvalence.",
          4: "{prenom} a de très bonnes qualités de passe, et en travaillant un peu plus sur son pied faible, il pourra devenir encore plus complet et efficace sur le terrain !",
          5: "{prenom} possède une qualité de transmission remarquable : dosage, timing et vision se conjuguent pour rendre son équipe dangereuse. C'est une vraie arme dans son jeu."
        }
      },
      {
        id: "controles",
        nom: "Contrôles",
        definition: "Première touche de balle, orientation du contrôle et capacité à se remettre en mouvement immédiatement après réception.",
        phrases: {
          1: "{prenom} doit travailler l'amorti et l'orientation de sa première touche, encore trop souvent subie. Ce point conditionne la suite de son action.",
          2: "{prenom} contrôle proprement quand il a du temps, mais sa première touche le met parfois en difficulté sous pression adverse.",
          3: "{prenom} maîtrise sa première touche et parvient à s'orienter correctement pour enchaîner. Une base saine sur laquelle construire.",
          4: "{prenom} maîtrise très bien sa balle, ce qui lui permet de contrôler le jeu avec aisance. Continue à travailler sur tes compétences, tu es sur la bonne voie !",
          5: "{prenom} possède une première touche d'exception : il oriente, élimine et accélère le jeu dans le même geste. Un atout majeur de son profil."
        }
      },
      {
        id: "conduite",
        nom: "Conduite",
        definition: "Conduite de balle en course, changements de direction et de rythme, protection du ballon dans les duels.",
        phrases: {
          1: "{prenom} doit gagner en aisance dans sa conduite de balle : la tête reste souvent baissée, ce qui limite sa prise d'information.",
          2: "{prenom} conduit correctement dans l'espace libre, mais perd le contrôle dès que la densité augmente autour de lui.",
          3: "{prenom} conduit son ballon avec sûreté et sait protéger sa balle dans les duels courants de sa catégorie.",
          4: "{prenom} a de bonnes capacités de conduite de balle, mais il peut encore s'améliorer lorsqu'il est sous pression. En travaillant sur sa gestion du ballon dans ces situations, il deviendra un joueur encore plus efficace !",
          5: "{prenom} élimine par la conduite avec une facilité déconcertante : changements de rythme, protection de balle et prise d'espace font de lui un déséquilibreur permanent."
        }
      }
    ]
  },

  {
    id: "cognitif",
    nom: "Cognitif",
    couleur: "#7c3aed",
    double: true,
    resume: "Lecture du jeu, prise d'information et qualité des décisions au service de l'organisation collective.",
    items: [
      {
        id: "gerer_temps_jeu",
        nom: "Gérer le temps de jeu",
        definition: "Capacité à identifier les temps forts et les temps faibles du match et à adapter son rythme en conséquence.",
        phrases: {
          1: "{prenom} joue encore sur un rythme unique et doit apprendre à distinguer les moments où il faut accélérer de ceux où il faut conserver.",
          2: "{prenom} commence à percevoir les temps faibles du match, mais son application reste irrégulière selon l'intensité de la rencontre.",
          3: "{prenom} gère correctement les alternances de rythme et sait temporiser lorsque son équipe en a besoin.",
          4: "{prenom} gère très bien le temps faible et montre sa force au sein de l'équipe. Cependant, il pourrait encore progresser en aidant ses coéquipiers à mieux comprendre ces phases de jeu. En partageant ses connaissances, il renforcera encore plus l'esprit d'équipe !",
          5: "{prenom} maîtrise remarquablement la gestion du tempo : il accélère, temporise et fait basculer le rythme du match au service de son équipe."
        }
      },
      {
        id: "equilibrer_jeu_equipe",
        nom: "Équilibrer le jeu de l'équipe",
        definition: "Occupation rationnelle des espaces, distances de passe et contribution à l'équilibre offensif comme défensif.",
        phrases: {
          1: "{prenom} doit progresser dans son placement : ses distances aux partenaires ne permettent pas encore à l'équipe de conserver sereinement.",
          2: "{prenom} se place correctement par intermittence, mais se retrouve encore souvent dans la zone d'un partenaire.",
          3: "{prenom} occupe l'espace de manière cohérente et participe à l'équilibre général de l'équipe.",
          4: "{prenom} démontre un excellent équilibre dans son jeu, ce qui lui permet de naviguer facilement sur le terrain.",
          5: "{prenom} est un véritable régulateur : son placement structure l'équipe et offre en permanence des solutions justes à ses partenaires."
        }
      },
      {
        id: "proposer_options_equipe",
        nom: "Proposer des options à l'équipe",
        definition: "Qualité et fréquence des appels, des démarquages et des solutions offertes au porteur du ballon.",
        phrases: {
          1: "{prenom} reste encore trop statique lorsque le ballon est chez un partenaire : il doit apprendre à se rendre disponible en permanence.",
          2: "{prenom} propose des solutions quand le jeu est simple, mais disparaît des circuits dès que la pression adverse augmente.",
          3: "{prenom} offre régulièrement des solutions crédibles à ses partenaires et sait se rendre disponible entre les lignes.",
          4: "{prenom}, dans la première partie du terrain, montre une belle capacité à se projeter offensivement et à créer des opportunités. Cependant, il doit encore travailler sur sa capacité à proposer des solutions à ses coéquipiers dans les phases offensives, même dans des situations plus difficiles. Continue à progresser, tu es sur la bonne voie !",
          5: "{prenom} est une solution permanente pour ses partenaires : ses appels créent des espaces et cassent l'organisation adverse."
        }
      }
    ]
  },

  {
    id: "emotif_volitif",
    nom: "Émotif - Volitif",
    couleur: "#dc2626",
    double: true,
    resume: "Énergie mise au service du jeu, engagement volontaire et régulation émotionnelle pendant la pratique.",
    items: [
      {
        id: "motivation_jeu",
        nom: "Montrer de la motivation pour le jeu",
        definition: "Envie exprimée avant, pendant et après la séance ; constance de l'investissement dans l'effort.",
        phrases: {
          1: "{prenom} doit retrouver du plaisir dans la pratique : son engagement varie fortement d'une séance à l'autre.",
          2: "{prenom} montre de l'envie sur les situations qu'il apprécie, mais décroche sur les contenus plus exigeants.",
          3: "{prenom} affiche une motivation constante et se présente aux séances avec une bonne disposition de travail.",
          4: "{prenom} montre une grande motivation pour le jeu, ce qui est contagieux pour toute l'équipe. Son enthousiasme et son engagement sur le terrain inspirent ses coéquipiers à donner le meilleur d'eux-mêmes. Continue à alimenter cette passion.",
          5: "{prenom} est un moteur d'énergie pour le groupe : sa passion tire l'ensemble de l'équipe vers le haut, chaque séance et chaque match."
        }
      },
      {
        id: "volonte_participer",
        nom: "Volonté de participer au jeu",
        definition: "Prise d'initiative, volonté d'être impliqué dans les actions décisives et acceptation du risque utile.",
        phrases: {
          1: "{prenom} se met encore en retrait des actions importantes et doit oser demander le ballon dans les moments qui comptent.",
          2: "{prenom} participe quand le jeu vient à lui, mais provoque rarement son implication.",
          3: "{prenom} s'implique volontiers dans le jeu et accepte les responsabilités qui lui sont confiées.",
          4: "{prenom} participe activement au jeu et montre un bon engagement sur le terrain. Pour aller encore plus loin, il pourrait envisager de prendre davantage de risques, notamment en cherchant à casser des lignes avec de belles passes. En ajoutant cette dimension à son jeu, il pourra renforcer son impact et aider l'équipe à se projeter vers l'avant. Continue à progresser, {prenom} !",
          5: "{prenom} veut le ballon en permanence, y compris dans les moments difficiles. Cette volonté d'assumer le jeu est une qualité de leader."
        }
      },
      {
        id: "gestion_emotions",
        nom: "Gestion des émotions",
        definition: "Capacité à réguler frustration, excitation et stress pour maintenir la lucidité de ses décisions.",
        phrases: {
          1: "{prenom} se laisse encore déborder par ses émotions, ce qui altère nettement la qualité de ses décisions.",
          2: "{prenom} garde son calme sur des matchs sereins, mais se crispe rapidement lorsque le score ou l'arbitrage lui sont défavorables.",
          3: "{prenom} régule correctement ses émotions et revient rapidement dans le match après un contretemps.",
          4: "{prenom} gère très bien ses émotions, ce qui lui permet de rester concentré et de prendre des décisions éclairées sur le terrain. Sa capacité à maintenir son calme, même dans des moments intenses, est un atout précieux pour l'équipe. Continue à utiliser cette force, {prenom}, elle fait de toi un leader naturel !",
          5: "{prenom} affiche une maîtrise émotionnelle remarquable pour son âge : plus la situation est tendue, plus il devient lucide et rassembleur."
        }
      }
    ]
  },

  {
    id: "creatif_expressif",
    nom: "Créatif - Expressif",
    couleur: "#ea580c",
    double: true,
    resume: "Richesse des solutions proposées, originalité du geste et capacité d'adaptation aux contextes changeants.",
    items: [
      {
        id: "essayer_solutions",
        nom: "Essayer différentes solutions",
        definition: "Variété du répertoire technique et tactique mobilisé pour résoudre un même problème de jeu.",
        phrases: {
          1: "{prenom} répète systématiquement la même réponse : il doit enrichir son répertoire pour ne plus être lisible.",
          2: "{prenom} commence à varier ses solutions, mais retombe sur ses automatismes dès qu'il est pressé.",
          3: "{prenom} dispose de plusieurs réponses techniques et sait choisir celle qui convient à la situation.",
          4: "{prenom} essaie plusieurs solutions pour aider son équipe, ce qui démontre sa créativité et son engagement. Pour aller encore plus loin, il doit continuer à réfléchir aux meilleures options pour soutenir ses coéquipiers, que ce soit en proposant des passes, en créant des espaces ou en communiquant. Cette mentalité proactive est essentielle pour maximiser l'impact de son jeu. Continue à explorer ces possibilités.",
          5: "{prenom} invente des solutions que peu de joueurs envisagent à son âge. Sa créativité est un facteur de déséquilibre permanent pour l'adversaire."
        }
      },
      {
        id: "imprevisible",
        nom: "Imprévisible",
        definition: "Capacité à surprendre l'adversaire par ses choix, ses feintes et ses ruptures de rythme.",
        phrases: {
          1: "{prenom} est encore très prévisible dans ses intentions, ce qui facilite la tâche défensive adverse.",
          2: "{prenom} tente ponctuellement de surprendre, mais ses initiatives manquent encore de conviction.",
          3: "{prenom} sait alterner jeu simple et prises d'initiative pour ne pas être totalement lisible.",
          4: "{prenom} est imprévisible sur le terrain, ce qui rend son jeu excitant et difficile à anticiper pour les adversaires. Sa capacité à surprendre par ses mouvements et ses décisions crée des opportunités pour l'équipe. Continue à cultiver cette imprévisibilité.",
          5: "{prenom} est un joueur de rupture : ses choix inattendus font basculer les situations et créent des occasions à partir de rien."
        }
      },
      {
        id: "adaptation_situations",
        nom: "S'adapte aux différentes situations",
        definition: "Souplesse face aux changements de poste, de système, d'adversaire ou de conditions de jeu.",
        phrases: {
          1: "{prenom} a besoin de repères très stables : tout changement de consigne ou de poste le déstabilise durablement.",
          2: "{prenom} s'adapte après un temps de latence, mais perd en efficacité pendant la phase d'ajustement.",
          3: "{prenom} accepte les changements de contexte et retrouve rapidement ses repères.",
          4: "{prenom} s'adapte très bien aux différentes situations sur le terrain, ce qui lui permet de répondre efficacement aux défis qui se présentent.",
          5: "{prenom} est polyvalent et immédiatement opérationnel quel que soit le poste, le système ou l'adversaire. Une qualité rare et précieuse."
        }
      }
    ]
  },

  {
    id: "mental",
    nom: "Mental",
    couleur: "#0d9488",
    double: true,
    resume: "Robustesse psychologique : rapport au résultat, à l'erreur — la sienne et celle des autres — et aux perturbations extérieures.",
    items: [
      {
        id: "gerer_resultat",
        nom: "Gérer le résultat",
        definition: "Capacité à maintenir son niveau de jeu et son attitude quel que soit le score et l'issue du match.",
        phrases: {
          1: "{prenom} est très affecté par le score : mené, il décroche du match presque complètement.",
          2: "{prenom} tient tant que le résultat est favorable, mais baisse sensiblement le pied quand l'équipe est menée.",
          3: "{prenom} conserve un niveau de jeu stable indépendamment du score.",
          4: "{prenom} doit encore travailler sur la gestion des résultats. En développant cette compétence, il pourra mieux influencer positivement son équipe, peu importe l'issue du match. Continue à progresser.",
          5: "{prenom} est totalement imperméable au score : il maintient exigence et lucidité jusqu'au coup de sifflet final et entraîne le groupe avec lui."
        }
      },
      {
        id: "gerer_propres_erreurs",
        nom: "Gérer ses propres erreurs",
        definition: "Vitesse de rebond après une erreur et capacité à en faire un support d'apprentissage plutôt qu'un frein.",
        phrases: {
          1: "{prenom} s'effondre après une erreur et met de longues minutes à revenir dans la partie.",
          2: "{prenom} rumine encore ses erreurs, ce qui l'amène souvent à en enchaîner une seconde dans la foulée.",
          3: "{prenom} accepte ses erreurs et repart rapidement sur l'action suivante.",
          4: "{prenom} doit encore travailler sur la gestion de ses erreurs en apprenant à passer rapidement à autre chose. En développant cette capacité à se relever et à se concentrer sur le jeu, il pourra continuer à progresser et à contribuer positivement à l'équipe. Chaque erreur est une opportunité d'apprentissage, alors reste positif.",
          5: "{prenom} transforme systématiquement l'erreur en information utile : il rebondit instantanément et redemande le ballon. Un état d'esprit exemplaire."
        }
      },
      {
        id: "gerer_erreurs_autres",
        nom: "Gérer les erreurs des autres",
        definition: "Attitude et communication à l'égard des partenaires en difficulté ou après une erreur collective.",
        phrases: {
          1: "{prenom} exprime trop ouvertement sa frustration envers ses partenaires, ce qui pèse sur le climat de l'équipe.",
          2: "{prenom} se contient mais laisse transparaître son agacement par son langage corporel.",
          3: "{prenom} accepte les erreurs de ses partenaires sans les stigmatiser.",
          4: "{prenom} accepte les erreurs de ses coéquipiers avec beaucoup de compréhension et les encourage toujours à se relever.",
          5: "{prenom} est le premier à relever un partenaire en difficulté. Son soutien inconditionnel est un facteur de cohésion majeur pour le groupe."
        }
      },
      {
        id: "gerer_facteurs_externes",
        nom: "Gérer les facteurs externes",
        definition: "Résistance aux perturbations extérieures : arbitrage, public, météo, terrain, comportement adverse.",
        phrases: {
          1: "{prenom} se laisse totalement happer par l'environnement extérieur, au détriment de sa concentration sur le jeu.",
          2: "{prenom} réagit encore beaucoup aux décisions arbitrales et aux sollicitations extérieures.",
          3: "{prenom} reste globalement concentré sur sa tâche malgré les perturbations du contexte.",
          4: "{prenom} peut encore travailler sur la gestion des facteurs externes, comme la pression des supporters. Apprendre à rester concentré et à ne pas se laisser distraire par l'environnement extérieur l'aidera à donner le meilleur de lui-même, même dans des situations stressantes. Avec un peu de pratique, il pourra mieux naviguer dans ces moments et continuer à progresser !",
          5: "{prenom} demeure totalement imperméable au contexte extérieur : rien ne le détourne de sa tâche, quelles que soient les circonstances."
        }
      }
    ]
  },

  {
    id: "socio_affectif",
    nom: "Socio - Affectif",
    couleur: "#16a34a",
    double: true,
    resume: "Qualité de la relation aux autres, compréhension des rôles collectifs et influence exercée sur le groupe.",
    items: [
      {
        id: "capacite_relation",
        nom: "Montrer la capacité de relation",
        definition: "Qualité des échanges avec les partenaires et le staff : écoute, communication, respect.",
        phrases: {
          1: "{prenom} reste très en retrait du groupe et communique peu avec ses partenaires comme avec le staff.",
          2: "{prenom} entretient de bonnes relations avec quelques camarades proches, mais reste discret dans le collectif élargi.",
          3: "{prenom} communique correctement avec l'ensemble du groupe et se montre à l'écoute des consignes.",
          4: "{prenom} possède de belles capacités relationnelles, ce qui lui permet de créer des liens forts avec ses coéquipiers et de favoriser un bon esprit d'équipe. Sa capacité à communiquer et à écouter les autres est un atout précieux pour notre groupe !",
          5: "{prenom} est un véritable liant au sein du groupe : il va vers tout le monde, écoute réellement et fédère naturellement autour de lui."
        }
      },
      {
        id: "identifie_roles",
        nom: "Identifie les rôles dans l'équipe",
        definition: "Compréhension de sa propre mission et de celle de ses partenaires au sein de l'organisation collective.",
        phrases: {
          1: "{prenom} doit encore clarifier sa mission sur le terrain et comprendre celle de ses partenaires directs.",
          2: "{prenom} connaît son rôle mais peine à anticiper celui des joueurs qui l'entourent.",
          3: "{prenom} identifie clairement les rôles de chacun et ajuste son positionnement en conséquence.",
          4: "{prenom} identifie très bien les rôles de chacun au sein de l'équipe et adapte son jeu pour servir l'organisation collective. C'est un repère fiable pour ses partenaires.",
          5: "{prenom} lit l'organisation collective comme un entraîneur : il ajuste, replace ses partenaires et anticipe les déséquilibres avant qu'ils n'apparaissent."
        }
      },
      {
        id: "empathie_jeu",
        nom: "Faire preuve d'empathie pendant le jeu",
        definition: "Capacité à percevoir l'état émotionnel de ses partenaires et à y répondre de manière ajustée.",
        phrases: {
          1: "{prenom} reste centré sur sa propre performance et perçoit peu l'état de ses partenaires.",
          2: "{prenom} remarque quand un camarade est en difficulté mais ne sait pas encore comment l'aider.",
          3: "{prenom} se montre attentif à ses partenaires et adapte son attitude à leur état du moment.",
          4: "{prenom} fait preuve d'empathie pendant les matchs, ce qui lui permet de comprendre les émotions et les besoins de ses coéquipiers. Cette qualité renforce les liens au sein de l'équipe et crée un environnement positif où chacun se sent soutenu. Continue à cultiver cette empathie, {prenom}, elle est précieuse pour notre dynamique d'équipe !",
          5: "{prenom} perçoit immédiatement l'état de chacun et trouve toujours le mot ou le geste juste. Une intelligence relationnelle remarquable."
        }
      },
      {
        id: "influence_positive",
        nom: "Influence positive sur l'équipe",
        definition: "Impact de son attitude, de son exemplarité et de sa communication sur la dynamique collective.",
        phrases: {
          1: "{prenom} a aujourd'hui une influence neutre voire pesante sur le groupe dans les moments difficiles.",
          2: "{prenom} entraîne le groupe quand tout va bien, mais son influence s'estompe dans l'adversité.",
          3: "{prenom} contribue positivement à l'ambiance du groupe par son attitude et son sérieux.",
          4: "{prenom} influence positivement son équipe par son attitude encourageante et son esprit d'équipe. Sa capacité à motiver ses coéquipiers et à créer une atmosphère de confiance contribue grandement à notre réussite collective. Continue à inspirer ceux qui t'entourent, {prenom}, ta présence fait vraiment la différence !",
          5: "{prenom} est un leader positif reconnu par le groupe : son exemplarité et sa capacité à rassembler élèvent le niveau collectif."
        }
      }
    ]
  }
];

/* ---- Utilitaires de calcul ------------------------------------------- */

/** Arrondi au dixième supérieur — méthode utilisée dans le rapport de référence. */
function arrondiMachina(valeur) {
  return Math.ceil(valeur * 10 - 1e-9) / 10;
}

function formatNote(valeur) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return valeur.toFixed(2).replace(".", ",");
}

/** Moyenne d'une structure : toutes les notes P et R saisies. */
function moyenneStructure(structure, notes) {
  const valeurs = [];
  structure.items.forEach(item => {
    const n = notes[item.id] || {};
    if (typeof n.P === "number") valeurs.push(n.P);
    if (structure.double && typeof n.R === "number") valeurs.push(n.R);
  });
  if (!valeurs.length) return null;
  return arrondiMachina(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
}

/** Moyenne générale : moyenne des moyennes de structure renseignées. */
function moyenneGenerale(notes) {
  const moyennes = STRUCTURES.map(s => moyenneStructure(s, notes)).filter(m => m !== null);
  if (!moyennes.length) return null;
  return arrondiMachina(moyennes.reduce((a, b) => a + b, 0) / moyennes.length);
}

function tousLesItems() {
  return STRUCTURES.flatMap(s => s.items.map(i => ({ ...i, structure: s })));
}

function trouverStructure(id) { return STRUCTURES.find(s => s.id === id); }
