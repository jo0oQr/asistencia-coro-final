const CACHE = "coro-v29";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./app.js",
  "./nube.js",
  "./manifest.json",
  "./icono-192.png",
  "./icono-512.png"
];

// Al instalar: guarda los archivos para usarlos sin internet
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ARCHIVOS);
    })
  );
  self.skipWaiting();
});

// Al activarse: borra versiones antiguas del caché
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres.filter(function (n) { return n !== CACHE; })
               .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Al pedir un archivo: intenta internet primero; si no hay, usa el guardado
self.addEventListener("fetch", function (evento) {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  // Solo manejamos archivos de la app y las librerías de Firebase (gstatic).
  // Todo lo demás (la conexión de datos de Firebase) pasa directo, sin tocarlo.
  const esMio = url.origin === self.location.origin;
  const esLibreria = url.hostname === "www.gstatic.com";

  if (peticion.method !== "GET" || (!esMio && !esLibreria)) {
    return;
  }

  evento.respondWith(
    fetch(peticion)
      .then(function (respuesta) {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(peticion, copia);
          });
        }
        return respuesta;
      })
      .catch(function () {
        return caches.match(peticion);
      })
  );
});