/* =========================================================================
   MACHINA RAPPORT — Service worker
   Met l'application en cache pour un fonctionnement hors connexion.
   Incrémenter VERSION à chaque mise en ligne pour forcer la mise à jour.
   ========================================================================= */

const VERSION = "machina-rapport-v1";

const RESSOURCES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/css/print.css",
  "./assets/js/referentiel.js",
  "./assets/js/questionnaires.js",
  "./assets/js/store.js",
  "./assets/js/rapport.js",
  "./assets/js/app.js",
  "./assets/icones/icone-192.png",
  "./assets/icones/icone-512.png",
  "./assets/icones/icone-apple-180.png"
];

/* Installation : mise en cache de l'ensemble de l'application. */
self.addEventListener("install", evenement => {
  evenement.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(RESSOURCES))
      .then(() => self.skipWaiting())
  );
});

/* Activation : suppression des caches des versions précédentes. */
self.addEventListener("activate", evenement => {
  evenement.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

/* Lecture : le cache d'abord, le réseau ensuite.
   Une réponse réseau valide vient rafraîchir le cache en arrière-plan. */
self.addEventListener("fetch", evenement => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  evenement.respondWith(
    caches.match(requete).then(enCache => {
      const depuisReseau = fetch(requete)
        .then(reponse => {
          if (reponse && reponse.ok && reponse.type === "basic") {
            const copie = reponse.clone();
            caches.open(VERSION).then(cache => cache.put(requete, copie));
          }
          return reponse;
        })
        .catch(() => enCache || caches.match("./index.html"));

      return enCache || depuisReseau;
    })
  );
});
