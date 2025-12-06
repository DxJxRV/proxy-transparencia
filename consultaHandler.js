// Funciones para manejar las consultas y procesamiento de datos

/**
 * Maneja la consulta al servidor upstream y procesa la respuesta
 */
export async function handleConsulta(req, targetUrl) {
  const timestamp = req.timestamp || new Date().toISOString();
  
  // Extraer información del request (ya procesada por el middleware)
  const { entidadFederativa, ...bodyWithoutFilter } = req.body;
  const nombreProfesor = bodyWithoutFilter.contenido || null;
  
  console.log(`[${timestamp}] 🏛️ Filtro entidad federativa: ${entidadFederativa || 'ninguno'}`);
  console.log(`[${timestamp}] 👤 Nombre profesor (contenido): ${nombreProfesor || 'ninguno'}`);
  console.log(`[${timestamp}] 🆔 Session ID: ${req.sid || 'sin sid'}`);
  console.log(`[${timestamp}] 📍 IP: ${req.clientIp}, User Agent: ${req.userAgent.substring(0, 50)}...`);
  console.log("Request Body:", bodyWithoutFilter);
  
  console.log(`[${timestamp}] 🔄 Enviando petición al servidor upstream...`);
  
  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "origin": "https://tematicos.plataformadetransparencia.org.mx",
      "referer": "https://tematicos.plataformadetransparencia.org.mx/"
    },
    body: JSON.stringify(bodyWithoutFilter),
  });

  const contentType = upstream.headers.get("content-type") || "application/json";
  const text = await upstream.text();

  if (upstream.ok) {
    console.log(`[${timestamp}] ✅ Petición ACEPTADA - Status: ${upstream.status}`);
  } else {
    console.log(`[${timestamp}] ❌ Petición RECHAZADA - Status: ${upstream.status}`);
  }

  // Si es JSON, procesamos la respuesta
  if (contentType.includes("application/json")) {
    const data = JSON.parse(text);
    
    // Verificamos si tiene la estructura esperada con payload.datosSolr
    if (data.paylod && data.paylod.datosSolr && Array.isArray(data.paylod.datosSolr)) {
      const result = await processDataSolr(
        data, 
        entidadFederativa, 
        timestamp, 
        upstream.status,
        req
      );
      return result;
    } else {
      console.log(`[${timestamp}] ⚠️ Estructura no esperada, devolviendo respuesta original`);
      return { status: upstream.status, contentType, data: text };
    }
  } else {
    console.log(`[${timestamp}] 📄 Respuesta no-JSON, devolviendo tal como viene`);
    return { status: upstream.status, contentType, data: text };
  }
}

/**
 * Procesa los datos de Solr filtrando por nombres únicos y entidad federativa
 */
async function processDataSolr(data, entidadFederativa, timestamp, status, req) {
  const totalRegistrosOriginales = data.paylod.datosSolr.length;
  
  // Guardar total de registros en el request para el middleware logger
  req.totalRegistros = totalRegistrosOriginales;
  
  // Filtrar por entidad federativa si se especifica
  let datosFiltrados = data.paylod.datosSolr;
  if (entidadFederativa) {
    datosFiltrados = datosFiltrados.filter(item => 
      item.entidadfederativa && item.entidadfederativa.toLowerCase().includes(entidadFederativa.toLowerCase())
    );
    console.log(`[${timestamp}] 🏛️ Filtrados por entidad federativa: ${datosFiltrados.length} registros`);
  }
  
  // Filtrar datos por nombres únicos
  const filteredData = filterByUniqueName(datosFiltrados);
  
  // Extraer entidades federativas únicas de los datos filtrados
  const entidadesFederativas = [...new Set(filteredData.map(item => 
    item.nombre ? (datosFiltrados.find(d => d.nombre === item.nombre)?.entidadfederativa) : null
  ))].filter(Boolean);
  
  const response = {
    datosSolr: filteredData,
    sujetosObligados: data.paylod.sujetosObligados || [],
    entidadesFederativas: entidadesFederativas
  };
  
  console.log(`[${timestamp}] 🔍 Datos filtrados: ${filteredData.length} registros únicos, ${entidadesFederativas.length} entidades federativas`);
  
  // El logging en BD se hace automáticamente en el middleware
  return { status, contentType: "application/json", data: response };
}

/**
 * Filtra por nombres únicos manteniendo montos, períodos y sujeto obligado
 */
function filterByUniqueName(data) {
  const uniqueCombinations = new Map();
  
  data.forEach(item => {
    
    // Normalizamos el nombre para comparación (convertimos a mayúsculas y quitamos espacios extra)
    const originalName = item.nombre;
    const normalizedName = originalName ? originalName.toUpperCase().trim() : null;
    const sujetoObligado = item.sujetoobligado;
    
    // Crear clave única combinando nombre + sujeto obligado
    const uniqueKey = `${normalizedName}|${sujetoObligado}`;
    
    if (normalizedName && sujetoObligado) {
      if (!uniqueCombinations.has(uniqueKey)) {
        uniqueCombinations.set(uniqueKey, {
          nombre: originalName, // Mantenemos el nombre original
          professorId: item.id,
          sujetoObligado: sujetoObligado,
          entidadFederativa: item.entidadfederativa, // Agregamos entidad federativa
          periodoMontos: [] // Array de objetos {periodo, monto}
        });
      }
      
      const entry = uniqueCombinations.get(uniqueKey);
      
      // Agregar relación período-monto si no existe ya esa combinación
      if (item.periodoreporta && item.montoneto) {
        const existeCombinacion = entry.periodoMontos.some(pm => 
          pm.periodo === item.periodoreporta && pm.monto === item.montoneto
        );
        
        if (!existeCombinacion) {
          entry.periodoMontos.push({
            periodo: item.periodoreporta,
            monto: item.montoneto
          });
        }
      }
    }
  });
  
  // Procesar cada entrada para agregar sueldoActual y sueldoMax
  const processedEntries = Array.from(uniqueCombinations.values()).map(entry => {
    // Parsear fechas para encontrar el más reciente
    
    const periodosConFecha = entry.periodoMontos.map(pm => {
      const fechaFin = parsearFechaFin(pm.periodo);
      const montoNumerico = parsearMonto(pm.monto);
      return {
        ...pm,
        fechaFin,
        montoNumerico
      };
    }).filter(pm => pm.fechaFin && pm.montoNumerico !== null);
    
    // Ordenar por fecha (más reciente primero)
    periodosConFecha.sort((a, b) => b.fechaFin - a.fechaFin);
    
    // Sueldo actual (más reciente)
    const sueldoActual = periodosConFecha.length > 0 ? periodosConFecha[0].monto : null;
    
    // Sueldo máximo
    const sueldoMaxObj = periodosConFecha.reduce((max, current) => {
      return current.montoNumerico > max.montoNumerico ? current : max;
    }, periodosConFecha[0] || { montoNumerico: 0 });
    
    const sueldoMax = sueldoMaxObj ? {
      monto: sueldoMaxObj.monto,
      periodo: sueldoMaxObj.periodo
    } : null;
    
    // Sueldo acumulado (suma de todos los montos)
    const sueldoAcumulado = periodosConFecha.reduce((sum, current) => {
      return sum + (current.montoNumerico || 0);
    }, 0);
    
    return {
      nombre: entry.nombre,
      sujetoObligado: entry.sujetoObligado,
      professorId: entry.professorId,
      entidadFederativa: entry.entidadFederativa,
      periodoMontos: entry.periodoMontos,
      sueldoActual,
      sueldoMax,
      sueldoAcumulado,
      sueldoMaxNumerico: sueldoMaxObj ? sueldoMaxObj.montoNumerico : 0 // Para ordenamiento
    };
  });
  
  // Ordenar por sueldo máximo de mayor a menor
  return processedEntries.sort((a, b) => b.sueldoMaxNumerico - a.sueldoMaxNumerico)
    .map(entry => {
      // Remover el campo auxiliar de ordenamiento
      const { sueldoMaxNumerico, ...entryWithoutSort } = entry;
      return entryWithoutSort;
    });
}

/**
 * Parsea la fecha final del período
 */
function parsearFechaFin(periodo) {
  try {
    // Formato: "01/02/2025 - 28/02/2025"
    const fechaFin = periodo.split(' - ')[1];
    if (!fechaFin) return null;
    
    const [dia, mes, año] = fechaFin.split('/');
    return new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
  } catch (error) {
    return null;
  }
}

/**
 * Parsea el monto a número
 */
function parsearMonto(monto) {
  try {
    // Formato: "$5,469.30"
    const numeroStr = monto.replace(/[$,]/g, '');
    return parseFloat(numeroStr);
  } catch (error) {
    return null;
  }
}

/**
 * Maneja el registro de vista de card de profesor
 */
export async function handleProfesorVista(req) {
  const timestamp = req.timestamp || new Date().toISOString();
  
  const {
    professorId,
    nombreProfesor,
    sujetoObligado,
    entidadFederativa,
    sueldoMaximo,
    sueldoAcumulado,
    ultimoSueldo
  } = req.body;
  
  console.log(`[${timestamp}] 👁️ Vista de card: ${nombreProfesor || 'Sin nombre'} (ID: ${professorId || 'Sin ID'})`);
  console.log(`[${timestamp}] 🆔 Session ID: ${req.sid || 'sin sid'}`);
  console.log(`[${timestamp}] 📍 IP: ${req.clientIp}`);

  // El logging en BD se hace automáticamente en el middleware
  return {
    success: true,
    message: 'Vista registrada correctamente'
  };
}

/**
 * Busca personas con el mismo apellido
 */
export async function buscarPorApellido(apellidoPaterno, apellidoMaterno, targetUrl, excludeProfessorId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 Buscando por apellidos: ${apellidoPaterno} ${apellidoMaterno || ''}`);

  try {
    // Construir jsonAtributos con los apellidos
    const jsonAtributos = {
      idEntidadFederativa: null,
      idSujetoObligado: null,
      nombre: "",
      primerApellido: apellidoPaterno,
      segundoApellido: apellidoMaterno || "",
      denominacionCargo: "",
      montoNetoRangoInicial: null,
      montoNetoRangoFinal: null
    };

    // Buscar por apellidos usando jsonAtributos
    const requestBody = {
      contenido: "",
      cantidad: 100,
      numeroPagina: 0,
      coleccion: "SUELDOS",
      dePaginador: false,
      idCompartido: "",
      filtroSeleccionado: "",
      tipoOrdenamiento: "COINCIDENCIA",
      sujetosObligados: { seleccion: [], descartado: [] },
      organosGarantes: { seleccion: [], descartado: [] },
      anioFechaInicio: { seleccion: [], descartado: [] },
      jsonAtributos
    };

    console.log(`[${timestamp}] 📤 JSON enviado a API de transparencia:`);
    console.log(JSON.stringify(requestBody, null, 2));

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": "https://tematicos.plataformadetransparencia.org.mx",
        "referer": "https://tematicos.plataformadetransparencia.org.mx/"
      },
      body: JSON.stringify(requestBody),
    });

    const text = await upstream.text();
    const data = JSON.parse(text);

    if (data.paylod && data.paylod.datosSolr && Array.isArray(data.paylod.datosSolr)) {
      // Filtrar datos por nombres únicos
      let filteredData = filterByUniqueName(data.paylod.datosSolr);

      // Excluir al profesor actual
      filteredData = filteredData.filter(person => person.professorId !== excludeProfessorId);

      // Ordenar por sueldo actual de mayor a menor
      filteredData.sort((a, b) => {
        const sueldoA = parsearMonto(a.sueldoActual || '$0');
        const sueldoB = parsearMonto(b.sueldoActual || '$0');
        return sueldoB - sueldoA;
      });

      // Limitar a 10 resultados
      filteredData = filteredData.slice(0, 10);

      console.log(`[${timestamp}] ✅ Encontrados ${filteredData.length} personas con apellidos similares`);

      return {
        success: true,
        data: filteredData.map(person => ({
          nombre: person.nombre,
          professorId: person.professorId,
          sueldoActual: person.sueldoActual,
          sujetoObligado: person.sujetoObligado,
          entidadFederativa: person.entidadFederativa
        }))
      };
    }

    return { success: true, data: [] };
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error al buscar por apellido:`, error);
    throw error;
  }
}

/**
 * Busca personas de la misma institución
 */
export async function buscarPorInstitucion(identificadorGrupo, idEntidadFederativa, sujetoObligado, targetUrl, excludeProfessorId) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🏛️ Buscando por institución: ${sujetoObligado.substring(0, 50)}...`);
  console.log(`[${timestamp}] 📋 ID Grupo: ${identificadorGrupo}`);
  console.log(`[${timestamp}] 📋 ID Entidad: ${idEntidadFederativa || 'No proporcionado'}`);

  try {
    const jsonAtributos = {
      idSujetoObligado: {
        id: identificadorGrupo,
        nombre: sujetoObligado
      },
      nombre: "",
      primerApellido: "",
      segundoApellido: "",
      denominacionCargo: "",
      montoNetoRangoInicial: null,
      montoNetoRangoFinal: null
    };

    // Agregar idEntidadFederativa solo si se proporciona
    if (idEntidadFederativa) {
      jsonAtributos.idEntidadFederativa = idEntidadFederativa;
    }

    const requestBody = {
      contenido: "",
      cantidad: 100,
      numeroPagina: 0,
      coleccion: "SUELDOS",
      dePaginador: false,
      idCompartido: "",
      filtroSeleccionado: "",
      tipoOrdenamiento: "COINCIDENCIA",
      sujetosObligados: { seleccion: [], descartado: [] },
      organosGarantes: { seleccion: [], descartado: [] },
      anioFechaInicio: { seleccion: [], descartado: [] },
      jsonAtributos
    };

    console.log(`[${timestamp}] 📤 JSON enviado a API de transparencia:`);
    console.log(JSON.stringify(requestBody, null, 2));

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": "https://tematicos.plataformadetransparencia.org.mx",
        "referer": "https://tematicos.plataformadetransparencia.org.mx/"
      },
      body: JSON.stringify(requestBody),
    });

    const text = await upstream.text();
    const data = JSON.parse(text);

    if (data.paylod && data.paylod.datosSolr && Array.isArray(data.paylod.datosSolr)) {
      // Filtrar datos por nombres únicos
      let filteredData = filterByUniqueName(data.paylod.datosSolr);

      // Excluir al profesor actual
      filteredData = filteredData.filter(person => person.professorId !== excludeProfessorId);

      // Ordenar por sueldo actual de mayor a menor
      filteredData.sort((a, b) => {
        const sueldoA = parsearMonto(a.sueldoActual || '$0');
        const sueldoB = parsearMonto(b.sueldoActual || '$0');
        return sueldoB - sueldoA;
      });

      // Limitar a 10 resultados
      filteredData = filteredData.slice(0, 10);

      console.log(`[${timestamp}] ✅ Encontrados ${filteredData.length} personas de la misma institución`);

      return {
        success: true,
        data: filteredData.map(person => ({
          nombre: person.nombre,
          professorId: person.professorId,
          sueldoActual: person.sueldoActual,
          sujetoObligado: person.sujetoObligado,
          entidadFederativa: person.entidadFederativa
        }))
      };
    }

    return { success: true, data: [] };
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error al buscar por institución:`, error);
    throw error;
  }
}
