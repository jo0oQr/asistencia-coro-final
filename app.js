// ----- AVISOS BONITOS (reemplazan a alert, confirm y prompt) -----
function crearModal(config) {
  return new Promise(function (resolver) {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";

    const caja = document.createElement("div");
    caja.className = "modal-caja";
    caja.setAttribute("role", "dialog");
    caja.setAttribute("aria-modal", "true");

    if (config.titulo) {
      const titulo = document.createElement("h3");
      titulo.className = "modal-titulo";
      titulo.textContent = config.titulo;
      caja.appendChild(titulo);
    }

    const texto = document.createElement("p");
    texto.className = "modal-texto";
    texto.textContent = config.mensaje;
    caja.appendChild(texto);

    let input = null;
    if (config.conCampo) {
      input = document.createElement("input");
      input.type = "text";
      input.className = "modal-input";
      input.value = config.valor || "";
      caja.appendChild(input);
    }

    const botones = document.createElement("div");
    botones.className = "modal-botones";

    // Lo que devuelve cada tipo de aviso al cancelar
    const alCancelar = config.conCampo ? null : (config.textoNo ? false : undefined);

    function cerrar(resultado) {
      document.removeEventListener("keydown", teclas);
      fondo.remove();
      resolver(resultado);
    }

    function aceptar() {
      cerrar(config.conCampo ? input.value : true);
    }

    function teclas(evento) {
      if (evento.key === "Escape") {
        cerrar(alCancelar);
      } else if (evento.key === "Enter" && config.conCampo) {
        aceptar();
      }
    }

    if (config.textoNo) {
      const botonNo = document.createElement("button");
      botonNo.className = "modal-btn secundario";
      botonNo.textContent = config.textoNo;
      botonNo.addEventListener("click", function () {
        cerrar(alCancelar);
      });
      botones.appendChild(botonNo);
    }

    const botonSi = document.createElement("button");
    botonSi.className = "modal-btn" + (config.peligro ? " peligro" : "");
    botonSi.textContent = config.textoSi || "Aceptar";
    botonSi.addEventListener("click", aceptar);
    botones.appendChild(botonSi);

    caja.appendChild(botones);
    fondo.appendChild(caja);

    // Tocar fuera de la ventana equivale a cancelar
    fondo.addEventListener("click", function (evento) {
      if (evento.target === fondo) {
        cerrar(alCancelar);
      }
    });

    document.addEventListener("keydown", teclas);
    document.body.appendChild(fondo);

    if (input) {
      input.focus();
      input.select();
    } else {
      botonSi.focus();
    }
  });
}

// Aviso con un solo botón
function avisar(mensaje, titulo) {
  return crearModal({ mensaje: mensaje, titulo: titulo || "Aviso", textoSi: "Entendido" });
}

// Pregunta de sí o no. Devuelve true o false
function confirmar(mensaje, opciones) {
  const o = opciones || {};
  return crearModal({
    mensaje: mensaje,
    titulo: o.titulo || "¿Estás segura?",
    textoSi: o.textoSi || "Aceptar",
    textoNo: o.textoNo || "Cancelar",
    peligro: o.peligro
  });
}

// Pide un texto. Devuelve el texto, o null si cancela
function preguntar(mensaje, valor, opciones) {
  const o = opciones || {};
  return crearModal({
    mensaje: mensaje,
    titulo: o.titulo || "Escribe aquí",
    textoSi: o.textoSi || "Guardar",
    textoNo: "Cancelar",
    conCampo: true,
    valor: valor
  });
}

// Mensajito que aparece unos segundos y se va solo
function mostrarToast(mensaje) {
  const viejo = document.getElementById("toast");
  if (viejo) {
    viejo.remove();
  }
  const el = document.createElement("div");
  el.id = "toast";
  el.className = "toast";
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(function () { el.classList.add("visible"); }, 10);
  setTimeout(function () {
    el.classList.remove("visible");
    setTimeout(function () { el.remove(); }, 300);
  }, 2500);
}

// ----- GUARDAR Y LEER DATOS DEL CELULAR -----
function leerDatos(clave, valorPorDefecto) {
  const texto = localStorage.getItem(clave);
  if (texto === null) {
    return valorPorDefecto;
  }
  return JSON.parse(texto);
}

function guardarDatos(clave, valor) {
  localStorage.setItem(clave, JSON.stringify(valor));
}

// Lista de coristas: cada uno tiene un id único y un nombre
let coristas = leerDatos("coristas", []);

// Lista de actividades (cada una con fecha, tipo y asistencia)
let actividades = leerDatos("actividades", []);

// Día que se está viendo en la pantalla del día, ej: "2026-10-10"
let fechaSeleccionada = null;

const TIPOS = {
  culto: "Culto",
  reunion: "Reunión",
  ensayo: "Ensayo",
  sinculto: "Sin culto"
};

// Convierte año, mes y día en texto "2026-10-05"
function crearFecha(anio, mes, dia) {
  return anio + "-" + String(mes + 1).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
}

// Convierte "2026-10-05" en una fecha real de JavaScript
function leerFecha(texto) {
  const partes = texto.split("-").map(Number);
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

// ----- VARIABLES BÁSICAS -----
const NOMBRES_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_CULTO = [1, 4, 6]; // 1 = lunes, 4 = jueves, 6 = sábado

// Mes que se está mostrando (empieza en el mes actual)
let fechaActual = new Date();
fechaActual.setDate(1);

// Un corista es "vigente" en una fecha si no tiene baja,
// o si la baja fue ese mismo día o después
function coristaVigente(corista, fecha) {
  return !corista.fechaBaja || fecha <= corista.fechaBaja;
}

function coristasDeLaFecha(fecha) {
  return coristas.filter(function (c) {
    return coristaVigente(c, fecha);
  });
}

function textoBaja(corista) {
  return "Ya no es parte del coro desde el " +
    leerFecha(corista.fechaBaja).toLocaleDateString("es-CL", {
      day: "numeric", month: "long", year: "numeric"
    });
}

// Solo la administradora puede eliminar definitivamente.
// (nube.js marca window.soyAdmin cuando entra su correo)
function esAdmin() {
  return window.soyAdmin === true;
}

// Las reuniones solo las modifica la administradora; las demás personas solo las ven
function soloVerReunion(act) {
  return act.tipo === "reunion" && !esAdmin();
}

// ----- CORISTAS INACTIVOS (aparte de las bajas) -----
// Un corista está inactivo si no subió a ningún culto en los últimos 14 días
// (y tampoco tuvo permiso en ninguno).
// Solo se miden los cultos ya guardados (cerrados). Si hay menos de 2 en ese
// periodo, no se marca a nadie, porque no hay datos suficientes para juzgar.
const DIAS_INACTIVIDAD = 14;
const MIN_CULTOS_PARA_JUZGAR = 2;

function calcularInactivos() {
  const hoy = new Date();
  const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - DIAS_INACTIVIDAD);
  const desde = crearFecha(limite.getFullYear(), limite.getMonth(), limite.getDate());
  const hasta = crearFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const cultos = actividades.filter(function (a) {
    return a.tipo === "culto" && a.cerrada && a.fecha >= desde && a.fecha <= hasta;
  });

  const inactivos = new Set();
  if (cultos.length < MIN_CULTOS_PARA_JUZGAR) {
    return inactivos;
  }

  coristas.forEach(function (corista) {
    if (corista.fechaBaja) {
      return; // los que ya no están en el coro no cuentan
    }
    if (corista.id > limite.getTime()) {
      return; // agregado hace poco: todavía no hay historial que evaluar
    }
    // Si subió a algún culto, o tuvo permiso en alguno, no está inactivo
    const activo = cultos.some(function (culto) {
      const estado = estadoDe(culto, corista);
      return estado === "subio" || estado === "permiso";
    });
    if (!activo) {
      inactivos.add(corista.id);
    }
  });

  return inactivos;
}

function dibujarResumenCoristas(cantidad, inactivos) {
  let caja = document.getElementById("resumen-coristas");
  if (!caja) {
    caja = document.createElement("div");
    caja.id = "resumen-coristas";
    const lista = document.getElementById("lista-resumen");
    lista.parentNode.insertBefore(caja, lista);
  }
  caja.innerHTML = "";

  const tarjetas = document.createElement("div");
  tarjetas.className = "tarjetas";

  const datos = [
    ["Cantidad de coristas", cantidad, ""],
    ["Coristas inactivos", inactivos,
      "Corista inactivo: no ha subido en " + Math.round(DIAS_INACTIVIDAD / 7) + " semanas"]
  ];

  datos.forEach(function (par) {
    const dato = document.createElement("div");
    dato.className = "dato-resumen";

    const etiqueta = document.createElement("span");
    etiqueta.textContent = par[0];
    const valor = document.createElement("strong");
    valor.textContent = par[1];
    dato.appendChild(etiqueta);
    dato.appendChild(valor);

    if (par[2]) {
      const nota = document.createElement("span");
      nota.className = "nota-tarjeta";
      nota.textContent = par[2];
      dato.appendChild(nota);
    }

    tarjetas.appendChild(dato);
  });
  caja.appendChild(tarjetas);
}

// ----- CORISTAS -----
function dibujarCoristas() {
  const lista = document.getElementById("lista-coristas");
  lista.innerHTML = "";

  // Solo la administradora puede agregar coristas
  document.querySelector(".agregar-corista").classList.toggle("oculto", !esAdmin());

  const activos = coristas.filter(function (c) { return !c.fechaBaja; });
  const exCoristas = coristas.filter(function (c) { return c.fechaBaja; });

  activos.forEach(function (corista) {
    const item = document.createElement("li");

    const nombre = document.createElement("span");
    nombre.textContent = corista.nombre;

    const botones = document.createElement("div");
    botones.className = "botones-corista";

    const botonEditar = document.createElement("button");
    botonEditar.className = "btn-editar";
    botonEditar.textContent = "Editar";
    botonEditar.addEventListener("click", function () {
      editarCorista(corista.id);
    });

    const botonQuitar = document.createElement("button");
    botonQuitar.textContent = "Quitar";
    botonQuitar.addEventListener("click", function () {
      quitarCorista(corista.id);
    });

    botones.appendChild(botonEditar);
    if (esAdmin()) {
      botones.appendChild(botonQuitar);
    }
    item.appendChild(nombre);
    item.appendChild(botones);
    lista.appendChild(item);
  });

  if (exCoristas.length > 0) {
    const titulo = document.createElement("li");
    titulo.className = "titulo-ex";
    titulo.textContent = "Ya no están en el coro";
    lista.appendChild(titulo);

    exCoristas.forEach(function (corista) {
      const item = document.createElement("li");

      const info = document.createElement("div");
      const nombre = document.createElement("span");
      nombre.textContent = corista.nombre;
      const baja = document.createElement("div");
      baja.className = "texto-baja";
      baja.textContent = textoBaja(corista);
      info.appendChild(nombre);
      info.appendChild(baja);

      const botones = document.createElement("div");
      botones.className = "botones-corista";

      const boton = document.createElement("button");
      boton.className = "btn-editar";
      boton.textContent = "Reactivar";
      boton.addEventListener("click", function () {
        reactivarCorista(corista.id);
      });
      // Solo la administradora puede reactivar o eliminar
      if (esAdmin()) {
        botones.appendChild(boton);

        const botonEliminar = document.createElement("button");
        botonEliminar.textContent = "Eliminar";
        botonEliminar.addEventListener("click", function () {
          eliminarCorista(corista.id);
        });
        botones.appendChild(botonEliminar);
      }

      item.appendChild(info);
      item.appendChild(botones);
      lista.appendChild(item);
    });
  }
}

async function editarCorista(id) {
  const corista = coristas.find(function (c) {
    return c.id === id;
  });
  const nuevo = await preguntar("Escribe el nombre nuevo.", corista.nombre, { titulo: "Editar corista", textoSi: "Guardar" });

  if (nuevo === null || nuevo.trim() === "") {
    return; // canceló o lo dejó vacío
  }

  corista.nombre = nuevo.trim();
  coristas.sort(function (a, b) {
    return a.nombre.localeCompare(b.nombre);
  });
  guardarDatos("coristas", coristas);
  dibujarCoristas();
}

function agregarCorista() {
  if (!esAdmin()) {
    avisar("Solo la administradora puede agregar coristas.", "Sin permiso");
    return;
  }
  const input = document.getElementById("input-nombre");
  const nombre = input.value.trim();

  if (nombre === "") {
    return; // si está vacío, no hace nada
  }

  const hoy = new Date();
    coristas.push({
      id: Date.now(),
      nombre: nombre,
      creado: crearFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  });

  guardarDatos("coristas", coristas);
  input.value = "";
  input.focus();
  dibujarCoristas();
}

async function quitarCorista(id) {
  if (!esAdmin()) {
    avisar("Solo la administradora puede dar de baja coristas.", "Sin permiso");
    return;
  }
  const seguro = await confirmar("Su historial y su porcentaje se mantienen hasta hoy, pero ya no aparecerá en las asistencias nuevas.", { titulo: "¿Dar de baja a este corista?", textoSi: "Dar de baja", peligro: true });
  if (!seguro) {
    return;
  }
  const corista = coristas.find(function (c) {
    return c.id === id;
  });
  const hoy = new Date();
  corista.fechaBaja = crearFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  guardarDatos("coristas", coristas);
  dibujarCoristas();
}

function reactivarCorista(id) {
  if (!esAdmin()) {
    avisar("Solo la administradora puede reactivar coristas.", "Sin permiso");
    return;
  }
  const corista = coristas.find(function (c) {
    return c.id === id;
  });
  delete corista.fechaBaja;
  guardarDatos("coristas", coristas);
  dibujarCoristas();
}

async function eliminarCorista(id) {
  if (!esAdmin()) {
    avisar("Solo la administradora puede eliminar coristas.", "Sin permiso");
    return;
  }

  const corista = coristas.find(function (c) {
    return c.id === id;
  });
  if (!corista) {
    return;
  }

  const seguro = await confirmar(
    "Se borrará de la lista y de los porcentajes de todos los meses. Esto no se puede deshacer.",
    { titulo: "¿Eliminar a " + corista.nombre + " definitivamente?", textoSi: "Eliminar", peligro: true }
  );
  if (!seguro) {
    return;
  }

  // Borra también sus marcas dentro de cada actividad
  actividades.forEach(function (act) {
    if (act.asistencia && act.asistencia[id] !== undefined) {
      delete act.asistencia[id];
    }
  });

  coristas = coristas.filter(function (c) {
    return c.id !== id;
  });

  guardarDatos("actividades", actividades);
  guardarDatos("coristas", coristas);
  dibujarCoristas();
  dibujarCalendario();
}

document.getElementById("btn-agregar").addEventListener("click", agregarCorista);
document.getElementById("input-nombre").addEventListener("keydown", function (evento) {
  if (evento.key === "Enter") {
    evento.preventDefault();
    agregarCorista();
  }
});

// ----- MENÚ ENTRE PANTALLAS -----
function mostrarPantalla(nombre) {
  document.getElementById("pantalla-calendario").classList.toggle("oculto", nombre !== "calendario");
  document.getElementById("pantalla-coristas").classList.toggle("oculto", nombre !== "coristas");
  document.getElementById("pantalla-dia").classList.toggle("oculto", nombre !== "dia");
  document.getElementById("pantalla-asistencia").classList.toggle("oculto", nombre !== "asistencia");
  document.getElementById("pantalla-resumen").classList.toggle("oculto", nombre !== "resumen");
  document.getElementById("pantalla-respaldo").classList.toggle("oculto", nombre !== "respaldo");
  document.getElementById("pantalla-reunion").classList.toggle("oculto", nombre !== "reunion");

  // El día y la asistencia cuentan como parte del calendario en el menú
  const enCalendario = nombre !== "coristas" && nombre !== "resumen" && nombre !== "respaldo";
  document.getElementById("nav-calendario").classList.toggle("activo", enCalendario);
  document.getElementById("nav-coristas").classList.toggle("activo", nombre === "coristas");
  document.getElementById("nav-resumen").classList.toggle("activo", nombre === "resumen");
  document.getElementById("nav-respaldo").classList.toggle("activo", nombre === "respaldo");
}

document.getElementById("nav-calendario").addEventListener("click", function () {
  mostrarPantalla("calendario");
});
document.getElementById("nav-coristas").addEventListener("click", function () {
  dibujarCoristas();
  mostrarPantalla("coristas");
});
document.getElementById("nav-resumen").addEventListener("click", function () {
  dibujarResumenMensual();
  mostrarPantalla("resumen");
});
document.getElementById("nav-respaldo").addEventListener("click", function () {
  dibujarInfoRespaldo();
  mostrarPantalla("respaldo");
});

// ----- DIBUJAR EL CALENDARIO -----
function dibujarCalendario() {
  const calendario = document.getElementById("calendario");
  const titulo = document.getElementById("titulo-mes");

  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth(); // 0 = enero, 11 = diciembre

  // Título: "octubre 2026"
  titulo.textContent = fechaActual.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric"
  });

  calendario.innerHTML = "";

  // Encabezados: Lun, Mar, Mié...
  NOMBRES_DIAS.forEach(function (nombre) {
    const celda = document.createElement("div");
    celda.className = "nombre-dia";
    celda.textContent = nombre;
    calendario.appendChild(celda);
  });

  // Qué día de la semana cae el día 1 (ajustado para que lunes sea el primero)
  const primerDia = new Date(anio, mes, 1).getDay(); // 0 = domingo
  const espacios = (primerDia + 6) % 7;

  // Casillas vacías antes del día 1
  for (let i = 0; i < espacios; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia vacio";
    calendario.appendChild(vacio);
  }

  // Cuántos días tiene el mes
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const hoy = new Date();

    for (let dia = 1; dia <= totalDias; dia++) {
    const celda = document.createElement("div");
    celda.className = "dia";
    celda.textContent = dia;

    const diaSemana = new Date(anio, mes, dia).getDay();
    if (DIAS_CULTO.includes(diaSemana)) {
      celda.classList.add("dia-culto");
    }

    const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
    if (esHoy) {
      celda.classList.add("hoy");
    }

    const fecha = crearFecha(anio, mes, dia);

    // Puntitos de colores: uno por cada actividad guardada ese día
    const puntos = document.createElement("div");
    puntos.className = "puntos";
    actividades.forEach(function (act) {
      if (act.fecha === fecha) {
        const punto = document.createElement("span");
        punto.className = "punto " + act.tipo;
        puntos.appendChild(punto);
      }
    });
    celda.appendChild(puntos);

    // Al tocar el día, se abre su pantalla
        if (fecha === fechaSeleccionada) {
      celda.classList.add("seleccionado");
    }

    // Al tocar el día, se muestra su detalle debajo del calendario
    celda.addEventListener("click", function () {
      seleccionarDia(fecha);
    });

        calendario.appendChild(celda);
  }

  dibujarDetalle();
}
// ----- BOTONES DE MES -----
document.getElementById("btn-anterior").addEventListener("click", function () {
  fechaActual.setMonth(fechaActual.getMonth() - 1);
  dibujarCalendario();
});

document.getElementById("btn-siguiente").addEventListener("click", function () {
  fechaActual.setMonth(fechaActual.getMonth() + 1);
  dibujarCalendario();
});

// ----- PANTALLA DEL DÍA -----
function abrirDia(fecha) {
  fechaSeleccionada = fecha;
  dibujarDia();
  mostrarPantalla("dia");
}

function dibujarDia() {
  const fecha = leerFecha(fechaSeleccionada);

  document.getElementById("titulo-dia").textContent = fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const lista = document.getElementById("lista-actividades");
  lista.innerHTML = "";

  const delDia = actividades.filter(function (a) {
    return a.fecha === fechaSeleccionada;
  });

  // Si es lunes, jueves o sábado y no hay culto ni "sin culto" registrado,
  // mostramos el culto como pendiente
  const esDiaCulto = DIAS_CULTO.includes(fecha.getDay());
  const tieneCulto = delDia.some(function (a) {
    return a.tipo === "culto" || a.tipo === "sinculto";
  });

  if (esDiaCulto && !tieneCulto) {
    const item = document.createElement("li");
    item.className = "pendiente";

    const texto = document.createElement("span");
    texto.textContent = TIPOS.culto + " (pendiente)";

    const boton = document.createElement("button");
    boton.textContent = "Registrar";
    boton.addEventListener("click", function () {
      crearActividad("culto");
    });

    item.appendChild(texto);
    item.appendChild(boton);
    lista.appendChild(item);
  }

  delDia.forEach(function (act) {
    const item = document.createElement("li");

    const texto = document.createElement("span");
        texto.textContent = TIPOS[act.tipo] + (act.cerrada ? " ✔" : "");

    const botones = document.createElement("div");
    botones.className = "botones-act";

    // Las reuniones tienen una ficha de detalles
    if (act.tipo === "reunion") {
      const botonDetalles = document.createElement("button");
      botonDetalles.className = "btn-asistencia";
      botonDetalles.textContent = "Detalles";
      botonDetalles.addEventListener("click", function () {
        abrirReunion(act.id);
      });
      botones.appendChild(botonDetalles);
    }

    // "Sin culto" no tiene asistencia
    if (act.tipo !== "sinculto") {
      const botonAsistencia = document.createElement("button");
      botonAsistencia.className = "btn-asistencia";
      botonAsistencia.textContent = "Asistencia";
      botonAsistencia.addEventListener("click", function () {
        abrirAsistencia(act.id);
      });
      botones.appendChild(botonAsistencia);
    }

    const botonQuitar = document.createElement("button");
    botonQuitar.textContent = "Quitar";
    botonQuitar.addEventListener("click", function () {
      quitarActividad(act.id);
    });
    if (!soloVerReunion(act)) {
      botones.appendChild(botonQuitar);
    }

    item.appendChild(texto);
    item.appendChild(botones);
    lista.appendChild(item);
  });

  if (lista.children.length === 0) {
    lista.innerHTML = "<li>No hay actividades este día.</li>";
  }
}

async function crearActividad(tipo) {
  if (tipo === "reunion" && !esAdmin()) {
    // Las demás personas no crean reuniones: abren los detalles para verlos
    const existente = actividades.find(function (a) {
      return a.fecha === fechaSeleccionada && a.tipo === "reunion";
    });
    if (existente) {
      abrirReunion(existente.id);
    } else {
      avisar("Todavía no hay una reunión registrada este día. Solo la administradora puede registrarla.", "Sin reunión");
    }
    return;
  }
  const delDia = actividades.filter(function (a) {
    return a.fecha === fechaSeleccionada;
  });

  // No repetir culto ni "sin culto" en el mismo día
  if (tipo === "culto" || tipo === "sinculto") {
    const yaExiste = delDia.some(function (a) {
      return a.tipo === tipo;
    });
    if (yaExiste) {
      avisar("Ese día ya tiene esa actividad.", "Actividad repetida");
      return;
    }
  }

  // "Sin culto" anula el culto de ese día
  if (tipo === "sinculto") {
    const hayCulto = delDia.some(function (a) {
      return a.tipo === "culto";
    });
    if (hayCulto) {
      if (!(await confirmar("Este día ya tiene un culto registrado. ¿Quieres reemplazarlo por 'Sin culto'?", { titulo: "Reemplazar culto", textoSi: "Reemplazar" }))) {
        return;
      }
      actividades = actividades.filter(function (a) {
        return !(a.fecha === fechaSeleccionada && a.tipo === "culto");
      });
    }
  }

  // Si registras un culto, no puede estar marcado "sin culto"
  if (tipo === "culto") {
    const haySinCulto = delDia.some(function (a) {
      return a.tipo === "sinculto";
    });
    if (haySinCulto) {
      avisar("Este día está marcado como 'Sin culto'. Quítalo primero.", "Día sin culto");
      return;
    }
  }

    const nueva = {
    id: Date.now(),
    fecha: fechaSeleccionada,
    tipo: tipo,
    asistencia: {}
  };
  anotarCambio(nueva);
  actividades.push(nueva);

  guardarDatos("actividades", actividades);
  dibujarDia();
  dibujarCalendario();
}

async function quitarActividad(id) {
  const aQuitar = actividades.find(function (a) {
    return a.id === id;
  });
  if (aQuitar && soloVerReunion(aQuitar)) {
    avisar("Solo la administradora puede quitar reuniones.", "Sin permiso");
    return;
  }
  if (!(await confirmar("Se perderá su asistencia y sus detalles.", { titulo: "¿Quitar esta actividad?", textoSi: "Quitar", peligro: true }))) {
    return;
  }
  actividades = actividades.filter(function (a) {
    return a.id !== id;
  });
  guardarDatos("actividades", actividades);
  dibujarDia();
  dibujarCalendario();
}

document.getElementById("btn-volver").addEventListener("click", function () {
  dibujarCalendario();
  mostrarPantalla("calendario");
});
document.getElementById("add-culto").addEventListener("click", function () {
  crearActividad("culto");
});
document.getElementById("add-reunion").addEventListener("click", function () {
  crearActividad("reunion");
});
document.getElementById("add-ensayo").addEventListener("click", function () {
  crearActividad("ensayo");
});
document.getElementById("add-sinculto").addEventListener("click", function () {
  crearActividad("sinculto");
});

// ----- ASISTENCIA -----
let actividadAbierta = null; // id de la actividad que se está marcando

const ESTADOS = {
  ausente: "Ausente",
  subio: "Subió",
  abajo: "Se quedó abajo",
  permiso: "Permiso",
  asistio: "Asistió"
};

// El orden en que cambian los estados con cada toque
const CICLO_CULTO = ["ausente", "subio", "abajo", "permiso"];
const CICLO_SIMPLE = ["ausente", "asistio"];

function buscarActividad() {
  return actividades.find(function (a) {
    return a.id === actividadAbierta;
  });
}

function cicloDe(act) {
  return act.tipo === "culto" ? CICLO_CULTO : CICLO_SIMPLE;
}

function estadoDe(act, corista) {
  return act.asistencia[corista.id] || "ausente";
}

function abrirAsistencia(id) {
  actividadAbierta = id;
  dibujarAsistencia();
  mostrarPantalla("asistencia");
}

function dibujarResumen() {
  const act = buscarActividad();
  const conteo = {};

    coristasDeLaFecha(act.fecha).forEach(function (c) {
    const estado = estadoDe(act, c);
    conteo[estado] = (conteo[estado] || 0) + 1;
  });

  const partes = [];
  Object.keys(ESTADOS).forEach(function (estado) {
    if (cicloDe(act).includes(estado)) {
      partes.push(ESTADOS[estado] + ": " + (conteo[estado] || 0));
    }
  });

  document.getElementById("resumen-asistencia").textContent = partes.join("  ·  ");
}

function dibujarAsistencia() {
  const act = buscarActividad();
  const fecha = leerFecha(act.fecha);
  const botonCerrar = document.getElementById("btn-cerrar-asistencia");

  document.getElementById("titulo-asistencia").textContent =
    TIPOS[act.tipo] + " - " +
    fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const lista = document.getElementById("lista-asistencia");
  lista.innerHTML = "";

  const coristasDelDia = coristasDeLaFecha(act.fecha);

  if (coristasDelDia.length === 0) {
    lista.innerHTML = "<li>Primero agrega coristas en la pestaña 👥 Coristas.</li>";
    document.getElementById("resumen-asistencia").textContent = "";
    botonCerrar.classList.add("oculto");
    return;
  }
  botonCerrar.classList.toggle("oculto", soloVerReunion(act));

  const soloLectura = act.cerrada || soloVerReunion(act);

  // El botón de abajo cambia según si está cerrada o abierta
  if (act.cerrada) {
    botonCerrar.textContent = "✏️ Editar";
    botonCerrar.classList.add("cerrada");
  } else {
    botonCerrar.textContent = "💾 Guardar y cerrar";
    botonCerrar.classList.remove("cerrada");
  }

  coristasDelDia.forEach(function (corista) {
    const item = document.createElement("li");

    const nombre = document.createElement("span");
    nombre.textContent = corista.nombre;
    item.appendChild(nombre);

    const estado = estadoDe(act, corista);

    if (soloLectura) {
      // Solo lectura: se muestra el estado, pero no se puede tocar
      const etiqueta = document.createElement("span");
      etiqueta.className = "etiqueta-estado estado-" + estado;
      etiqueta.textContent = ESTADOS[estado];
      item.appendChild(etiqueta);
    } else {
      const boton = document.createElement("button");
      boton.textContent = ESTADOS[estado];
      boton.className = "estado-" + estado;

      boton.addEventListener("click", function () {
        const ciclo = cicloDe(act);
        const actual = estadoDe(act, corista);
        const siguiente = ciclo[(ciclo.indexOf(actual) + 1) % ciclo.length];

        act.asistencia[corista.id] = siguiente;
        anotarCambio(act);
        document.getElementById("ultimo-cambio").textContent = textoUltimoCambio(act);
        guardarDatos("actividades", actividades);

        boton.textContent = ESTADOS[siguiente];
        boton.className = "estado-" + siguiente;
        dibujarResumen();
      });

      item.appendChild(boton);
    }

    lista.appendChild(item);
  });

  dibujarResumen();
}

document.getElementById("btn-volver-dia").addEventListener("click", function () {
  dibujarDia();
  mostrarPantalla("dia");
});

document.getElementById("btn-cerrar-asistencia").addEventListener("click", async function () {
  const act = buscarActividad();
  if (soloVerReunion(act)) {
    return;
  }

  if (act.cerrada) {
    // Reabrir para corregir
    if (!(await confirmar("Podrás modificar las marcas de esta asistencia.", { titulo: "¿Editar asistencia guardada?", textoSi: "Editar" }))) {
      return;
    }
    act.cerrada = false;
    guardarDatos("actividades", actividades);
    dibujarAsistencia();
  } else {
    // Guardar y cerrar
    act.cerrada = true;
    guardarDatos("actividades", actividades);
    dibujarDia();
    mostrarPantalla("dia");
  }
});

// ----- DETALLES DE LA REUNIÓN -----
let reunionAbierta = null;     // id de la reunión que se está editando
let reunionModificada = false; // true si hay cambios sin guardar

function formatoPesos(numero) {
  return "$" + Number(numero).toLocaleString("es-CL");
}

function lineasReunion(act) {
  const d = act.detalles;
  const lineas = [];
  if (!d) {
    return lineas;
  }
  if (d.horaInicio || d.horaTermino) {
    lineas.push("Horario: " + (d.horaInicio || "—") + " a " + (d.horaTermino || "—"));
  }
  if (d.oracionInicial) {
    lineas.push("Oración inicial: " + d.oracionInicial);
  }
  if (d.palabra) {
    lineas.push("Palabra: " + d.palabra);
  }
  if (d.monto !== "" && d.monto !== null && d.monto !== undefined) {
    lineas.push("Monto en caja: " + formatoPesos(d.monto));
  }
  if (d.oracionFinal) {
    lineas.push("Oración final: " + d.oracionFinal);
  }
  return lineas;
}

// Datos de la reunión como pares [etiqueta, valor] para mostrarlos ordenados
function filasReunion(act) {
  const d = act.detalles;
  const filas = [];
  if (!d) {
    return filas;
  }
  if (d.horaInicio || d.horaTermino) {
    filas.push(["Horario", (d.horaInicio || "—") + " a " + (d.horaTermino || "—")]);
  }
  if (d.oracionInicial) {
    filas.push(["Oración inicial", d.oracionInicial]);
  }
  if (d.palabra) {
    filas.push(["Palabra", d.palabra]);
  }
  if (d.monto !== "" && d.monto !== null && d.monto !== undefined) {
    filas.push(["Monto en caja", formatoPesos(d.monto)]);
  }
  if (d.oracionFinal) {
    filas.push(["Oración final", d.oracionFinal]);
  }
  return filas;
}

function abrirReunion(id) {
  const act = actividades.find(function (a) {
    return a.id === id;
  });
  if (!act) {
    return;
  }

  reunionAbierta = id;
  reunionModificada = false;
  const d = act.detalles || {};

  document.getElementById("titulo-reunion").textContent =
    "Reunión - " + leerFecha(act.fecha).toLocaleDateString("es-CL", {
      weekday: "long", day: "numeric", month: "long"
    });
  document.getElementById("ultimo-cambio-reunion").textContent = textoUltimoCambio(act);

  document.getElementById("reu-hora-inicio").value = d.horaInicio || "";
  document.getElementById("reu-oracion-inicial").value = d.oracionInicial || "";
  document.getElementById("reu-palabra").value = d.palabra || "";
  document.getElementById("reu-monto").value =
    (d.monto === "" || d.monto === null || d.monto === undefined) ? "" : d.monto;
  document.getElementById("reu-detalles").value = d.detalles || "";
  document.getElementById("reu-oracion-final").value = d.oracionFinal || "";
  document.getElementById("reu-hora-termino").value = d.horaTermino || "";

  // Sugerencias: los coristas vigentes ese día (igual se puede escribir otro nombre)
  const lista = document.getElementById("lista-nombres");
  lista.innerHTML = "";
  coristasDeLaFecha(act.fecha).forEach(function (corista) {
    const opcion = document.createElement("option");
    opcion.value = corista.nombre;
    lista.appendChild(opcion);
  });

  // Las demás personas solo pueden ver la ficha
  const soloVer = !esAdmin();
  document.querySelectorAll("#pantalla-reunion input, #pantalla-reunion textarea").forEach(function (campo) {
    campo.disabled = soloVer;
  });
  document.getElementById("btn-guardar-reunion").classList.toggle("oculto", soloVer);
  document.getElementById("aviso-reunion").classList.toggle("oculto", !soloVer);

  mostrarPantalla("reunion");
  window.scrollTo(0, 0);
}

async function volverDeReunion() {
  if (reunionModificada) {
    const salir = await confirmar("Los cambios que no guardaste se van a perder.", {
      titulo: "¿Salir sin guardar?", textoSi: "Salir sin guardar", peligro: true
    });
    if (!salir) {
      return;
    }
  }
  reunionModificada = false;
  dibujarDia();
  mostrarPantalla("dia");
}

async function guardarReunion() {
  if (!esAdmin()) {
    avisar("Solo la administradora puede modificar los detalles de la reunión.", "Sin permiso");
    return;
  }
  const act = actividades.find(function (a) {
    return a.id === reunionAbierta;
  });
  if (!act) {
    await avisar("Esta reunión ya no existe (alguien la quitó).", "No se pudo guardar");
    mostrarPantalla("calendario");
    return;
  }

  const horaInicio = document.getElementById("reu-hora-inicio").value;
  const horaTermino = document.getElementById("reu-hora-termino").value;
  const montoTexto = document.getElementById("reu-monto").value.trim();

  if (horaInicio && horaTermino && horaTermino < horaInicio) {
    await avisar("La hora de término es anterior a la hora de inicio. Revísalas.", "Revisa las horas");
    return;
  }
  if (montoTexto !== "" && (isNaN(Number(montoTexto)) || Number(montoTexto) < 0)) {
    await avisar("El monto en caja debe ser un número, sin letras.", "Revisa el monto");
    return;
  }

  act.detalles = {
    horaInicio: horaInicio,
    oracionInicial: document.getElementById("reu-oracion-inicial").value.trim(),
    palabra: document.getElementById("reu-palabra").value.trim(),
    monto: montoTexto === "" ? "" : Number(montoTexto),
    detalles: document.getElementById("reu-detalles").value.trim(),
    oracionFinal: document.getElementById("reu-oracion-final").value.trim(),
    horaTermino: horaTermino
  };
  anotarCambio(act);
  guardarDatos("actividades", actividades);

  reunionModificada = false;
  dibujarDia();
  dibujarCalendario();
  mostrarPantalla("dia");
  mostrarToast("Detalles de la reunión guardados");
}

document.getElementById("btn-volver-reunion").addEventListener("click", volverDeReunion);
document.getElementById("btn-guardar-reunion").addEventListener("click", guardarReunion);
document.getElementById("pantalla-reunion").addEventListener("input", function () {
  reunionModificada = true;
});

// ----- DETALLE DEL DÍA (debajo del calendario) -----
function seleccionarDia(fecha) {
  fechaSeleccionada = fecha;
  dibujarCalendario();
}

function dibujarDetalle() {
  const caja = document.getElementById("detalle-dia");

  if (!fechaSeleccionada) {
    caja.classList.add("oculto");
    return;
  }

  caja.classList.remove("oculto");
  caja.innerHTML = "";

  const fecha = leerFecha(fechaSeleccionada);
  const titulo = document.createElement("h3");
  titulo.textContent = fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  caja.appendChild(titulo);

  const delDia = actividades.filter(function (a) {
    return a.fecha === fechaSeleccionada;
  });

  if (delDia.length === 0) {
    const aviso = document.createElement("p");
    aviso.className = "vacio-detalle";
    aviso.textContent = "No hay actividades registradas este día.";
    caja.appendChild(aviso);
  }

  delDia.forEach(function (act) {
    // Cada actividad va en su propio recuadro, con una franja de color según su tipo
    const bloque = document.createElement("section");
    bloque.className = "bloque tipo-" + act.tipo;
    caja.appendChild(bloque);

    const encabezado = document.createElement("div");
    encabezado.className = "bloque-encabezado";
    const nombreTipo = document.createElement("h4");
    nombreTipo.textContent = TIPOS[act.tipo];
    encabezado.appendChild(nombreTipo);
    if (act.cerrada) {
      const sello = document.createElement("span");
      sello.className = "sello-cerrada";
      sello.textContent = "Guardada";
      encabezado.appendChild(sello);
    }
    bloque.appendChild(encabezado);

    const cambio = textoUltimoCambio(act);
    if (cambio) {
      const lineaCambio = document.createElement("p");
      lineaCambio.className = "ultimo-cambio-detalle";
      lineaCambio.textContent = cambio;
      bloque.appendChild(lineaCambio);
    }

    // "Sin culto" no tiene lista de coristas
    if (act.tipo === "sinculto") {
      return;
    }

    // Datos de la reunión (si ya tiene detalles)
    if (act.tipo === "reunion") {
      const filas = filasReunion(act);
      const conversado = act.detalles && act.detalles.detalles;

      if (filas.length > 0 || conversado) {
        const ficha = document.createElement("div");
        ficha.className = "ficha-reunion";

        filas.forEach(function (fila) {
          const linea = document.createElement("div");
          linea.className = "fila-dato";
          const etiqueta = document.createElement("span");
          etiqueta.className = "dato-etiqueta";
          etiqueta.textContent = fila[0];
          const valor = document.createElement("span");
          valor.className = "dato-valor";
          valor.textContent = fila[1];
          linea.appendChild(etiqueta);
          linea.appendChild(valor);
          ficha.appendChild(linea);
        });

        if (conversado) {
          const texto = document.createElement("div");
          texto.className = "dato-texto";
          const etiqueta = document.createElement("span");
          etiqueta.className = "dato-etiqueta";
          etiqueta.textContent = "Lo que se habló";
          const parrafo = document.createElement("p");
          parrafo.textContent = conversado;
          texto.appendChild(etiqueta);
          texto.appendChild(parrafo);
          ficha.appendChild(texto);
        }

        bloque.appendChild(ficha);
      }
    }

    const lista = document.createElement("ul");
    lista.className = "lista-asistentes";
    let hayAlguien = false;

    coristasDeLaFecha(act.fecha).forEach(function (corista) {
      const estado = estadoDe(act, corista);
      if (estado === "ausente") {
        return; // solo mostramos a los que fueron o tuvieron permiso
      }
      hayAlguien = true;

      const item = document.createElement("li");
      const nombre = document.createElement("span");
      nombre.className = "nombre-asistente";
      nombre.textContent = corista.nombre;
      const etiqueta = document.createElement("span");
      etiqueta.className = "chip estado-" + estado;
      etiqueta.textContent = ESTADOS[estado];
      item.appendChild(nombre);
      item.appendChild(etiqueta);
      lista.appendChild(item);
    });

    if (hayAlguien) {
      bloque.appendChild(lista);
    } else {
      const aviso = document.createElement("p");
      aviso.className = "vacio-detalle";
      aviso.textContent = "Todavía no hay coristas marcados.";
      bloque.appendChild(aviso);
    }

    const acciones = document.createElement("div");
    acciones.className = "acciones-bloque";

    const boton = document.createElement("button");
    boton.textContent = (act.cerrada || soloVerReunion(act)) ? "Ver asistencia" : "Marcar asistencia";
    boton.addEventListener("click", function () {
      abrirAsistencia(act.id);
    });
    acciones.appendChild(boton);

    if (act.tipo === "reunion") {
      const botonFicha = document.createElement("button");
      botonFicha.textContent = "Detalles de la reunión";
      botonFicha.addEventListener("click", function () {
        abrirReunion(act.id);
      });
      acciones.appendChild(botonFicha);
    }

    bloque.appendChild(acciones);
  });

  const botonActividades = document.createElement("button");
  botonActividades.className = "secundario";
  botonActividades.textContent = "Agregar o quitar actividades";
  botonActividades.addEventListener("click", function () {
    abrirDia(fechaSeleccionada);
  });
  caja.appendChild(botonActividades);
}

// ----- RESUMEN MENSUAL (%) -----
// Si quieres que el permiso cuente como falta, cambia true por false
const PERMISO_DESCUENTA = true;

let vistaResumen = "corista"; // "corista" o "general"

// Mes que se muestra en el resumen (empieza en el mes actual)
let mesResumen = new Date();
mesResumen.setDate(1);


function crearFilaResumen(nombre, detalle, porcentaje, destacada, inactivo) {
  const item = document.createElement("li");
  if (destacada) {
    item.style.border = "2px solid #4a3f8f";
  }

  const izquierda = document.createElement("div");
  const titulo = document.createElement("div");
  titulo.className = "nombre-resumen";
  titulo.textContent = nombre;
  const sub = document.createElement("div");
  sub.className = "detalle-corista";
  if (typeof detalle === "string") {
    sub.textContent = detalle;
  } else {
    sub.appendChild(detalle);
  }
    izquierda.appendChild(titulo);
    if (inactivo) {
      const linea = document.createElement("div");
      linea.className = "linea-sello";
      const sello = document.createElement("span");
      sello.className = "sello-cerrada";
      sello.textContent = "Inactivo";
      linea.appendChild(sello);
      izquierda.appendChild(linea);
  }
  izquierda.appendChild(sub);

  const derecha = document.createElement("div");
  derecha.className = "porcentaje";
  derecha.textContent = porcentaje;

  item.appendChild(izquierda);
  item.appendChild(derecha);
  return item;
}

function crearDetalleCorista(subio, total, nota) {
  const caja = document.createElement("div");

  const principal = document.createElement("div");
  principal.className = "cultos-principal";
  principal.innerHTML = "Subió a <strong>" + subio + " de " + total + "</strong> cultos";
  caja.appendChild(principal);

  if (nota) {
    const aviso = document.createElement("div");
    aviso.className = "texto-baja";
    aviso.textContent = nota;
    caja.appendChild(aviso);
  }

  return caja;
}

function contarEstados(culto) {
  const c = { subio: 0, abajo: 0, permiso: 0, ausente: 0, total: 0 };
  coristasDeLaFecha(culto.fecha).forEach(function (corista) {
    c.total++;
    const estado = estadoDe(culto, corista);
    if (c[estado] !== undefined) {
      c[estado]++;
    } else {
      c.ausente++;
    }
  });
  return c;
}

// Cuenta los cultos del mes (lunes, jueves y sábado, menos "Sin culto",
// más cultos extra). Si se indica "hasta", cuenta solo hasta esa fecha.
function contarCultosDelMes(anio, mes, hasta) {
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  let total = 0;

  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = crearFecha(anio, mes, dia);

    if (hasta && fecha > hasta) {
      continue;
    }

    const delDia = actividades.filter(function (a) {
      return a.fecha === fecha;
    });

    const sinCulto = delDia.some(function (a) {
      return a.tipo === "sinculto";
    });
    if (sinCulto) {
      continue;
    }

    const esDiaCulto = DIAS_CULTO.includes(new Date(anio, mes, dia).getDay());
    const hayCulto = delDia.some(function (a) {
      return a.tipo === "culto";
    });

    if (esDiaCulto || hayCulto) {
      total++;
    }
  }

  return total;
}

function dibujarResumenMensual() {
  const anio = mesResumen.getFullYear();
  const mes = mesResumen.getMonth();
  const prefijo = anio + "-" + String(mes + 1).padStart(2, "0");

  document.getElementById("titulo-resumen").textContent =
    mesResumen.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  document.getElementById("vista-corista").classList.toggle("activo", vistaResumen === "corista");
  document.getElementById("vista-general").classList.toggle("activo", vistaResumen === "general");

  // Solo cultos cerrados de ese mes
  const cultos = actividades.filter(function (a) {
    return a.tipo === "culto" && a.cerrada && a.fecha.startsWith(prefijo);
  }).sort(function (a, b) {
    return a.fecha.localeCompare(b.fecha);
  });

  const totalMes = contarCultosDelMes(anio, mes);

  document.getElementById("info-resumen").textContent =
    "Cultos del mes: " + totalMes + " · Ya guardados: " + cultos.length;

  const lista = document.getElementById("lista-resumen");
  lista.innerHTML = "";
  const inactivos = calcularInactivos();
  dibujarResumenCoristas(
    coristas.filter(function (c) { return !c.fechaBaja; }).length,
    inactivos.size
  );

  if (coristas.length === 0) {
    lista.innerHTML = "<li>Aún no hay coristas.</li>";
    return;
  }

  if (vistaResumen === "corista") {
    // ----- Vista por corista -----
    coristas.forEach(function (corista) {
      // Cultos del mes hasta la baja (si la tiene)
      const totalCorista = contarCultosDelMes(anio, mes, corista.fechaBaja);

      // Si lo dieron de baja antes de este mes, no aparece
      if (corista.fechaBaja && totalCorista === 0) {
        return;
      }

      const cultosCorista = cultos.filter(function (culto) {
        return coristaVigente(corista, culto.fecha);
      });

      let subio = 0, permiso = 0;
      cultosCorista.forEach(function (culto) {
        const estado = estadoDe(culto, corista);
        if (estado === "subio") subio++;
        else if (estado === "permiso") permiso++;
      });

      const base = cultosCorista.length - (PERMISO_DESCUENTA ? permiso : 0);
      const porcentaje = base > 0 ? Math.round((subio / base) * 100) + "%" : "—";
      const nota = corista.fechaBaja ? textoBaja(corista) : "";
      const detalle = crearDetalleCorista(subio, totalCorista, nota);

      lista.appendChild(crearFilaResumen(corista.nombre, detalle, porcentaje, false, inactivos.has(corista.id)));
    });
  } else {
    // ----- Vista general -----
    let totalSubio = 0, totalAbajo = 0, totalPermiso = 0, totalAusente = 0, totalBase = 0;

    cultos.forEach(function (culto) {
      const c = contarEstados(culto);
      totalSubio += c.subio;
      totalAbajo += c.abajo;
      totalPermiso += c.permiso;
      totalAusente += c.ausente;
      totalBase += c.total - (PERMISO_DESCUENTA ? c.permiso : 0);
    });

    const general = totalBase > 0 ? Math.round((totalSubio / totalBase) * 100) + "%" : "—";
    const detalleGeneral = "Subió " + totalSubio + " · Abajo " + totalAbajo +
                           " · Permiso " + totalPermiso + " · Ausente " + totalAusente;

    lista.appendChild(crearFilaResumen("Todos los coristas", detalleGeneral, general, true));

    // Una línea por cada culto del mes
    cultos.forEach(function (culto) {
      const c = contarEstados(culto);
      const base = c.total - (PERMISO_DESCUENTA ? c.permiso : 0);
      const porcentaje = base > 0 ? Math.round((c.subio / base) * 100) + "%" : "—";
      const fecha = leerFecha(culto.fecha).toLocaleDateString("es-CL", {
        weekday: "long", day: "numeric", month: "long"
      });
      const detalle = "Subieron " + c.subio + " de " + base;

      lista.appendChild(crearFilaResumen(fecha, detalle, porcentaje, false));
    });
  }
}

document.getElementById("vista-corista").addEventListener("click", function () {
  vistaResumen = "corista";
  dibujarResumenMensual();
});
document.getElementById("vista-general").addEventListener("click", function () {
  vistaResumen = "general";
  dibujarResumenMensual();
});

document.getElementById("resumen-anterior").addEventListener("click", function () {
  mesResumen.setMonth(mesResumen.getMonth() - 1);
  dibujarResumenMensual();
});
document.getElementById("resumen-siguiente").addEventListener("click", function () {
  mesResumen.setMonth(mesResumen.getMonth() + 1);
  dibujarResumenMensual();
});

// ----- RESPALDO -----
function dibujarInfoRespaldo() {
  const ultimo = leerDatos("ultimoRespaldo", null);
  const texto = ultimo
    ? "Último respaldo: " + new Date(ultimo).toLocaleDateString("es-CL", {
        day: "numeric", month: "long", year: "numeric"
      })
    : "Todavía no has hecho ningún respaldo.";

  document.getElementById("info-respaldo").textContent =
    texto + " · " + coristas.length + " coristas, " + actividades.length + " actividades guardadas.";
}

document.getElementById("btn-exportar").addEventListener("click", function () {
  const datos = {
    version: 1,
    coristas: coristas,
    actividades: actividades
  };

  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);

  const hoy = new Date();
  enlace.download = "respaldo-coro-" + crearFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) + ".json";
  enlace.click();
  URL.revokeObjectURL(enlace.href);

  guardarDatos("ultimoRespaldo", hoy.toISOString());
  dibujarInfoRespaldo();
});

document.getElementById("btn-importar").addEventListener("click", function () {
  document.getElementById("archivo-importar").click();
});

document.getElementById("archivo-importar").addEventListener("change", function (evento) {
  const archivo = evento.target.files[0];
  if (!archivo) {
    return;
  }

  const lector = new FileReader();
  lector.onload = async function () {
    try {
      const datos = JSON.parse(lector.result);

      if (!Array.isArray(datos.coristas) || !Array.isArray(datos.actividades)) {
        throw new Error("Formato incorrecto");
      }

      const mensaje = "Este respaldo tiene " + datos.coristas.length + " coristas y " +
        datos.actividades.length + " actividades.\n\nSe REEMPLAZARÁ todo lo que hay ahora en este celular. ¿Continuar?";
      if (!(await confirmar(mensaje, { titulo: "Restaurar respaldo", textoSi: "Reemplazar todo", peligro: true }))) {
        return;
      }

      coristas = datos.coristas;
      actividades = datos.actividades;
      guardarDatos("coristas", coristas);
      guardarDatos("actividades", actividades);

      fechaSeleccionada = null;
      dibujarCoristas();
      dibujarCalendario();
      dibujarInfoRespaldo();
      avisar("Respaldo restaurado correctamente.", "Listo");
    } catch (error) {
      avisar("No se pudo leer el archivo. Asegúrate de elegir un respaldo exportado desde esta app.", "No se pudo restaurar");
    }

      document.getElementById("input-usuario").value = leerDatos("usuario", "");
  };
  lector.readAsText(archivo);

  evento.target.value = ""; // permite elegir el mismo archivo otra vez
});

// ----- QUIÉN HIZO EL CAMBIO -----
function pedirNombre() {
  // Si entró con su cuenta, usamos ese nombre automáticamente
  if (window.nombreUsuario) {
    return window.nombreUsuario;
  }
  let nombre = leerDatos("usuario", "");
  if (!nombre) {
    const respuesta = prompt("¿Cuál es tu nombre? Quedará anotado en los cambios que hagas.");
    if (respuesta && respuesta.trim() !== "") {
      nombre = respuesta.trim();
      guardarDatos("usuario", nombre);
    }
  }
  return nombre || "Sin nombre";
}

function anotarCambio(act) {
  act.modificadoPor = pedirNombre();
  act.modificadoEn = new Date().toISOString();
}

function textoUltimoCambio(act) {
  if (!act.modificadoPor) {
    return "";
  }
  const cuando = new Date(act.modificadoEn).toLocaleString("es-CL", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
  });
  return "Último cambio: " + act.modificadoPor + ", " + cuando;
}

document.getElementById("input-usuario").addEventListener("change", function (evento) {
  guardarDatos("usuario", evento.target.value.trim());
});

// ----- ARRANQUE -----
dibujarCalendario();
dibujarCoristas();

// ----- APP INSTALABLE -----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

// ----- BOTÓN "ATRÁS" DEL CELULAR -----
// La app lleva su propia lista de pantallas visitadas. Así, "atrás" vuelve a la
// pantalla anterior y, estando en el calendario, sale de la app.
const PANTALLAS_MENU = ["coristas", "resumen", "respaldo"];
const SESION = String(Date.now());
const mostrarPantallaBase = mostrarPantalla;
let pila = ["calendario"];
let restaurandoReunion = false;

function guardarEstado(reemplazar) {
  const estado = { pila: pila.slice(), sesion: SESION };
  if (reemplazar) {
    history.replaceState(estado, "");
  } else {
    history.pushState(estado, "");
  }
}

// Reemplaza a la función original: además de mostrar la pantalla, anota el paso
mostrarPantalla = function (nombre, desdeHistorial) {
  mostrarPantallaBase(nombre);
  if (desdeHistorial) {
    return;
  }

  const actual = pila[pila.length - 1];
  if (nombre === actual) {
    return;
  }

  // Si esa pantalla ya está en la lista, retrocedemos hasta ella
  const posicion = pila.lastIndexOf(nombre);
  if (posicion !== -1) {
    const pasos = pila.length - 1 - posicion;
    pila.length = posicion + 1;
    history.go(-pasos);
    return;
  }

  // Cambiar entre pestañas del menú no suma pasos; salir de una ficha al día tampoco
  const entreMenus = PANTALLAS_MENU.includes(nombre) && PANTALLAS_MENU.includes(actual);
  const salidaDeFicha = nombre === "dia" && (actual === "asistencia" || actual === "reunion");
  if (entreMenus || salidaDeFicha) {
    pila[pila.length - 1] = nombre;
    guardarEstado(true);
    return;
  }

  pila.push(nombre);
  guardarEstado(false);
};

function mostrarDesdeHistorial(nombre) {
  let valida = true;
  if (nombre === "asistencia") {
    valida = !!buscarActividad();
  } else if (nombre === "reunion") {
    valida = reunionAbierta !== null && actividades.some(function (a) {
      return a.id === reunionAbierta;
    });
  }

  if (!valida) {
    pila = ["calendario"];
    guardarEstado(true);
    nombre = "calendario";
  }

  if (nombre === "calendario") {
    dibujarCalendario();
  } else if (nombre === "coristas") {
    dibujarCoristas();
  } else if (nombre === "dia") {
    if (fechaSeleccionada) {
      dibujarDia();
    } else {
      pila = ["calendario"];
      guardarEstado(true);
      nombre = "calendario";
      dibujarCalendario();
    }
  } else if (nombre === "asistencia") {
    dibujarAsistencia();
  } else if (nombre === "resumen") {
    dibujarResumenMensual();
  } else if (nombre === "respaldo") {
    dibujarInfoRespaldo();
  }
  // (la ficha de reunión no se redibuja para no borrar lo que se escribió)

  mostrarPantallaBase(nombre);
}

window.addEventListener("popstate", function (evento) {
  const estado = evento.state;

  // Pasos guardados antes de recargar la página: se saltan
  if (!estado || estado.sesion !== SESION) {
    history.back();
    return;
  }

  const antes = pila[pila.length - 1];
  const destino = estado.pila[estado.pila.length - 1];

  // Segunda parte: volvimos a la ficha de reunión, ahora sí preguntamos
  if (restaurandoReunion) {
    restaurandoReunion = false;
    pila = estado.pila.slice();
    mostrarPantallaBase("reunion");
    volverDeReunion();
    return;
  }

  // Salir de la ficha de reunión con cambios sin guardar: primero se deshace
  // el paso atrás y se pregunta si de verdad quiere salir
  if (antes === "reunion" && destino !== "reunion" && reunionModificada) {
    restaurandoReunion = true;
    history.go(1);
    return;
  }

  pila = estado.pila.slice();
  mostrarDesdeHistorial(destino);
});

// Punto de partida: el calendario
guardarEstado(true);