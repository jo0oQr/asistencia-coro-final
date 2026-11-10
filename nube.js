// ===== SINCRONIZACIÓN CON FIREBASE =====
// Este archivo se carga DESPUÉS de app.js. Conecta tus datos con la nube
// para que todos los celulares del coro vean lo mismo.
// La app sigue guardando también en el celular, así que funciona sin internet.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDB2r2HFD1Kx7_AqDl9Nc-5c-aw---vpa8",
  authDomain: "asistencia-coro.firebaseapp.com",
  projectId: "asistencia-coro",
  storageBucket: "asistencia-coro.firebasestorage.app",
  messagingSenderId: "1075846142333",
  appId: "1:1075846142333:web:6aa0725cb59babc4785414"
};

// Correo de la administradora (la única que ve los botones de eliminar).
// Debe estar en minúsculas y ser el mismo que pusiste en las reglas de Firestore.
const ADMIN_EMAIL = "josefa.ayline20@gmail.com";
// Correos de quienes pueden modificar Tesorería además de la administradora (en minúsculas)
const TESOREROS_EMAIL = ["heltonceb@gmail.com", "ben.monsalve@duocuc.cl"];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Guarda una copia en el celular, para que funcione sin internet
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// La función original de app.js (guarda solo en el celular)
const guardarLocal = window.guardarDatos;

let codigoCoro = null;
const listo = { coristas: false, actividades: false };
const decidido = { coristas: false, actividades: false };
const estadoNube = { coristas: new Map(), actividades: new Map() };

// ----- Mensajito de estado en el encabezado -----
function mostrarEstado(texto) {
  let el = document.getElementById("estado-nube");
  if (!el) {
    el = document.createElement("div");
    el.id = "estado-nube";
    el.style.cssText = "font-size:12px;opacity:.85;margin-top:4px;";
    document.querySelector("header").appendChild(el);
  }
  el.textContent = texto;
}

let ultimoAvisoPermiso = 0;

function avisarError(error) {
  console.error("Error de sincronización:", error);
  mostrarEstado("☁️ Error al sincronizar");

  // Si Firebase rechaza el cambio por permisos, lo decimos claro
  // (un aviso cada 10 segundos como máximo)
  if (error && error.code === "permission-denied" && Date.now() - ultimoAvisoPermiso > 10000) {
    ultimoAvisoPermiso = Date.now();
    alert("Firebase no permitió este cambio (permiso denegado).\n\n" +
      "Revisa que tu correo esté en las reglas de Firestore y que las reglas estén publicadas. " +
      "El cambio se deshará en unos segundos.");
  }
}

// ----- Ayudas -----
function listaLocal(nombre) {
  return nombre === "coristas" ? coristas : actividades;
}

function coleccion(nombre) {
  return collection(db, "coros", codigoCoro, nombre);
}

function documento(nombre, id) {
  return doc(db, "coros", codigoCoro, nombre, id);
}

// ----- Código del coro -----
const CODIGO_CORO = "iglesiaelarca2026";

function obtenerCodigo() {
  return CODIGO_CORO;
}
// ----- Subir a la nube solo lo que cambió -----
function enviarCambios(nombre, lista) {
  if (!listo[nombre] || !codigoCoro) {
    return;
  }

  const enNube = estadoNube[nombre];
  const idsActuales = new Set();

  lista.forEach(function (item) {
    const id = String(item.id);
    idsActuales.add(id);
    const json = JSON.stringify(item);

    if (enNube.get(id) !== json) {
      enNube.set(id, json);
      setDoc(documento(nombre, id), JSON.parse(json)).catch(avisarError);
    }
  });

  // Lo que ya no está en la lista local, se borra de la nube
  Array.from(enNube.keys()).forEach(function (id) {
    if (!idsActuales.has(id)) {
      enNube.delete(id);
      deleteDoc(documento(nombre, id)).catch(avisarError);
    }
  });
}

// Cada vez que app.js guarda coristas o actividades, también las subimos
window.guardarDatos = function (clave, valor) {
  guardarLocal(clave, valor);
  if (clave === "coristas" || clave === "actividades") {
    enviarCambios(clave, valor);
  }
};

// ----- Redibujar la pantalla que esté abierta -----
function pantallaVisible(id) {
  return !document.getElementById(id).classList.contains("oculto");
}

function redibujar() {
  dibujarCoristas();
  dibujarCalendario();

  if (pantallaVisible("pantalla-asistencia")) {
    if (buscarActividad()) {
      dibujarAsistencia();
    } else {
      mostrarPantalla("calendario"); // la actividad fue borrada desde otro celular
    }
  }
  if (pantallaVisible("pantalla-dia") && fechaSeleccionada) {
    dibujarDia();
  }
  if (pantallaVisible("pantalla-resumen")) {
    dibujarResumenMensual();
  }
}

// ----- Escuchar los cambios de la nube -----
function escuchar(nombre) {
  onSnapshot(
    coleccion(nombre),
    function (snap) {
      const nuevos = [];
      const mapa = new Map();
      snap.forEach(function (d) {
        const datos = d.data();
        nuevos.push(datos);
        mapa.set(d.id, JSON.stringify(datos));
      });

      if (!decidido[nombre]) {
        if (snap.metadata.fromCache) {
          // Todavía sin respuesta del servidor (por ejemplo, sin internet).
          // Solo anotamos qué hay en la nube y seguimos con los datos del celular.
          estadoNube[nombre] = mapa;
          listo[nombre] = true;
          mostrarEstado("☁️ Sin conexión: se sincroniza al volver");
          return;
        }

        // Primera respuesta real del servidor
        decidido[nombre] = true;
        listo[nombre] = true;

        const yaMigrado = leerDatos("migrado-" + nombre, false);
        const local = listaLocal(nombre);
        guardarLocal("migrado-" + nombre, true);

        // Nube vacía + datos en este celular = subimos lo que ya tenías
        if (snap.empty && !yaMigrado && local.length > 0) {
          estadoNube[nombre] = new Map();
          enviarCambios(nombre, local);
          mostrarEstado("☁️ Subiendo tus datos a la nube…");
          return;
        }
      }

      estadoNube[nombre] = mapa;

      // Pasamos lo de la nube a la lista local, reutilizando los objetos
      // que ya existen para no dejar referencias viejas en pantalla
      const actual = listaLocal(nombre);
      const porId = new Map(actual.map(function (x) {
        return [String(x.id), x];
      }));

      const resultado = nuevos.map(function (n) {
        const viejo = porId.get(String(n.id));
        if (!viejo) {
          return n;
        }
        Object.keys(viejo).forEach(function (k) {
          delete viejo[k];
        });
        Object.assign(viejo, n);
        return viejo;
      });

      if (nombre === "coristas") {
        resultado.sort(function (a, b) {
          return a.nombre.localeCompare(b.nombre);
        });
      }

      actual.splice(0, actual.length, ...resultado);
      guardarLocal(nombre, actual);
      redibujar();

      mostrarEstado(snap.metadata.fromCache
        ? "☁️ Sin conexión: se sincroniza al volver"
        : "☁️ Sincronizado");
    },
    function (error) {
      console.error("No se pudo leer la nube:", error);
      if (error.code === "permission-denied") {
        const correo = auth.currentUser ? auth.currentUser.email : "";
        mostrarLogin("Tu correo (" + correo + ") no tiene permiso para entrar. " +
          "Pídele a la administradora que lo agregue, o entra con otra cuenta.");
      }
      mostrarEstado("☁️ Sin acceso a la nube");
    }
  );
}

// ----- Arranque -----
function iniciar() {
  codigoCoro = obtenerCodigo();
  if (!codigoCoro) {
    mostrarEstado("☁️ Sin nube: falta el código del coro");
    return;
  }
  escuchar("coristas");
  escuchar("actividades");
}

mostrarEstado("☁️ Conectando…");

// ----- Pantalla de ingreso (se crea sola, no hay que tocar el HTML) -----
function mostrarLogin(mensaje) {
  let caja = document.getElementById("pantalla-login");

  if (!caja) {
    caja = document.createElement("div");
    caja.id = "pantalla-login";
    caja.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:50;background:#f4f4f8;" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "padding:24px;text-align:center;font-family:Arial,sans-serif;color:#222;";

    const titulo = document.createElement("h2");
    titulo.textContent = "Asistencia Coro";

    const texto = document.createElement("p");
    texto.id = "login-mensaje";
    texto.style.maxWidth = "320px";

    const boton = document.createElement("button");
    boton.textContent = "Entrar con Google";
    boton.style.cssText =
      "background:#4a3f8f;color:white;border:none;border-radius:8px;" +
      "padding:14px 20px;font-size:16px;";
    boton.addEventListener("click", entrarConGoogle);

    caja.appendChild(titulo);
    caja.appendChild(texto);
    caja.appendChild(boton);
    document.body.appendChild(caja);
  }

  document.getElementById("login-mensaje").textContent =
    mensaje || "Entra con tu cuenta de Google para ver y registrar la asistencia.";
  caja.style.display = "flex";
}

function ocultarLogin() {
  const caja = document.getElementById("pantalla-login");
  if (caja) {
    caja.style.display = "none";
  }
}

function entrarConGoogle() {
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: "select_account" });

  signInWithPopup(auth, proveedor)
    .then(function () {
      // Si antes se había entrado con otra cuenta, recargamos para empezar limpio
      if (yaIniciado) {
        location.reload();
      }
    })
    .catch(function (error) {
      console.error("No se pudo entrar:", error);
      if (error.code !== "auth/popup-closed-by-user" &&
          error.code !== "auth/cancelled-popup-request") {
        mostrarLogin("No se pudo entrar (" + error.code + "). Intenta de nuevo.");
      }
    });
}

// ----- Quién está usando la app -----
function prepararUsuario(usuario) {
  const correo = (usuario.email || "").toLowerCase();

  window.nombreUsuario = usuario.displayName || correo;
  window.soyAdmin = correo === ADMIN_EMAIL.toLowerCase();
  window.puedeTesoreria = window.soyAdmin || TESOREROS_EMAIL.includes(correo);

  let el = document.getElementById("sesion-nube");
  if (!el) {
    el = document.createElement("div");
    el.id = "sesion-nube";
    el.style.cssText = "font-size:12px;opacity:.85;margin-top:2px;";
    document.querySelector("header").appendChild(el);
  }
  el.textContent = correo + (window.soyAdmin ? " (administradora)" : "") + " · ";

  const salir = document.createElement("a");
  salir.textContent = "Salir";
  salir.href = "#";
  salir.style.color = "white";
  salir.addEventListener("click", function (evento) {
    evento.preventDefault();
    signOut(auth).then(function () {
      location.reload();
    });
  });
  el.appendChild(salir);

  dibujarCoristas(); // para mostrar u ocultar los botones de eliminar
}

mostrarEstado("☁️ Conectando…");

let yaIniciado = false;
onAuthStateChanged(auth, function (usuario) {
  if (usuario && !usuario.isAnonymous) {
    ocultarLogin();
    prepararUsuario(usuario);
    if (!yaIniciado) {
      yaIniciado = true;
      iniciar();
    }
  } else {
    mostrarEstado("☁️ Sin sesión");
    mostrarLogin();
  }
});