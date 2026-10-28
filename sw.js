/* sw.js — para que el portal nunca se quede pegado en una version vieja.

   El problema real: Ana tiene el portal como icono en la pantalla de
   inicio. Ese webview guarda index.html y lo puede seguir sirviendo por
   dias. Ella ve una version vieja, no hay como recargarla desde un icono,
   y nadie se entera de que esta viendo algo de la semana pasada.

   Ponerle ?v= a los archivos no alcanza, porque el que dice que ?v= hay
   que cargar es justamente index.html. Si index.html esta viejo, pide los
   archivos viejos, y todo el versionado no sirve de nada.

   Esto hace una sola cosa: cada vez que se abre el portal, index.html se
   pide a la red sin pasar por ninguna cache. Si no hay internet, se sirve
   la ultima copia guardada para que no quede una pantalla en blanco. Los
   demas archivos ya van versionados desde index.html, asi que no hay que
   tocarlos aqui.

   No hay que subirle version a este archivo: el navegador lo revisa solo
   cada vez que se abre la app. */

const CACHE = 'proven-shell';
const LLAVE = './';          // una sola copia de respaldo, sin importar el ?x= que traiga la URL

self.addEventListener('install', function () {
  /* Sin esto, una version nueva se queda esperando a que se cierren todas
     las pestañas. En un icono de homescreen eso puede no pasar nunca. */
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  /* Solo la pagina. Los datos de Supabase, las fuentes y los archivos con
     ?v= pasan derecho: aqui no se tocan. */
  if (e.request.mode !== 'navigate') return;

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(function (red) {
        caches.open(CACHE).then(function (c) { c.put(LLAVE, red.clone()); });
        return red;
      })
      .catch(function () {
        return caches.match(LLAVE).then(function (guardada) {
          if (guardada) return guardada;
          return new Response(
            '<!doctype html><meta charset="utf-8">'
            + '<body style="font:16px system-ui;padding:40px;text-align:center">'
            + '<p>Sin conexion. Abre el portal otra vez cuando tengas internet.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
  );
});
