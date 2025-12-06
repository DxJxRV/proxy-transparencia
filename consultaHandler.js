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

  console.log(`[${timestamp}] 🔄 Enviando petición al servidor upstream...`);

  try {
    const { consultarTransparencia } = await import('./transparenciaClient.js');

    // Usar el cliente genérico
    const result = await consultarTransparencia(targetUrl, {
      contenido: bodyWithoutFilter.contenido || '',
      cantidad: bodyWithoutFilter.cantidad || 200,
      numeroPagina: bodyWithoutFilter.numeroPagina || 0,
      jsonAtributos: bodyWithoutFilter.jsonAtributos || null,
      tipoOrdenamiento: bodyWithoutFilter.tipoOrdenamiento || 'COINCIDENCIA',
      dePaginador: bodyWithoutFilter.dePaginador || false
    });

    if (result.success && result.data.length > 0) {
      console.log(`[${timestamp}] ✅ Petición ACEPTADA - ${result.data.length} resultados`);

      // Construir estructura compatible con el formato original (data.paylod)
      const dataForProcessing = {
        paylod: {
          datosSolr: result.data,
          sujetosObligados: result.sujetosObligados,
          organosGarantes: result.organosGarantes,
          anioFechaInicio: result.anioFechaInicio,
          paginador: result.paginador
        }
      };

      const processedResult = await processDataSolr(
        dataForProcessing,
        entidadFederativa,
        timestamp,
        200,
        req
      );
      return processedResult;
    } else {
      console.log(`[${timestamp}] ⚠️ Sin resultados o error en consulta`);
      return {
        status: 200,
        contentType: "application/json",
        data: {
          datosSolr: [],
          sujetosObligados: [],
          entidadesFederativas: []
        }
      };
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error en consulta:`, error);
    return {
      status: 500,
      contentType: "application/json",
      data: { error: error.message }
    };
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
    entidadesFederativas: entidadesFederativas,
    paginador: data.paylod.paginador || null // Incluir información de paginación
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
 * Hace dos consultas: una específica con jsonAtributos y otra general con texto plano
 * Soporta paginación del servidor
 * @param {boolean} fetchAll - Si true, retorna todos los datos sin paginación
 * @param {number} maxRecords - Límite máximo de registros a traer de Transparencia (0 = sin límite, default 5000)
 * @param {string} searchText - Texto de búsqueda adicional para filtrar (opcional)
 */
export async function buscarPorApellido(apellidoPaterno, apellidoMaterno, targetUrl, excludeProfessorId, numeroPagina = 0, fetchAll = false, maxRecords = 5000, searchText = '') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 Buscando por apellidos: ${apellidoPaterno} ${apellidoMaterno || ''} (página ${numeroPagina})`);
  console.log(`[${timestamp}] 🎯 Límite de registros: ${maxRecords}`);
  console.log(`[${timestamp}] 🔍 Texto de búsqueda: ${searchText || 'ninguno'}`);

  try {
    const { consultarTransparencia, buildJsonAtributosApellidos } = await import('./transparenciaClient.js');

    const cantidadPorPagina = 10;

    // Si hay texto de búsqueda, usarlo directamente con los apellidos
    if (searchText && searchText.trim()) {
      const busquedaCombinada = apellidoMaterno
        ? `${apellidoPaterno} ${apellidoMaterno} ${searchText.trim()}`
        : `${apellidoPaterno} ${searchText.trim()}`;

      console.log(`[${timestamp}] 🔍 Búsqueda combinada: ${busquedaCombinada}`);

      // Solo una consulta con búsqueda combinada
      const primeraConsulta = await consultarTransparencia(targetUrl, {
        contenido: busquedaCombinada,
        cantidad: 200,
        numeroPagina: 0
      });

      let todosLosDatos = [];
      let totalPaginas = 0;
      let paginasTraidas = 0;

      if (primeraConsulta.success && primeraConsulta.data.length > 0) {
        todosLosDatos = [...primeraConsulta.data];
        const paginas = primeraConsulta.paginador?.numeroPaginas || 1;
        totalPaginas = paginas;

        const paginasNecesarias = maxRecords > 0 ? Math.ceil(maxRecords / 200) : paginas;
        const paginasATraer = Math.min(paginasNecesarias, paginas);
        paginasTraidas = paginasATraer;

        if (paginasATraer > 1) {
          console.log(`[${timestamp}] 🔄 Búsqueda combinada: trayendo ${paginasATraer - 1} páginas adicionales (límite: ${maxRecords})...`);
          const promesas = [];
          for (let i = 1; i < paginasATraer; i++) {
            promesas.push(
              consultarTransparencia(targetUrl, {
                contenido: busquedaCombinada,
                cantidad: 200,
                numeroPagina: i
              })
            );
          }
          const resultados = await Promise.all(promesas);
          resultados.forEach(r => {
            if (r.success && r.data.length > 0) {
              todosLosDatos.push(...r.data);
            }
          });
        }
      }

      const hasMore = paginasTraidas < totalPaginas;

      // Obtener el total real del servidor
      const totalRealServidor = primeraConsulta.paginador?.total || 0;

      if (todosLosDatos.length > 0) {
        let filteredData = filterByUniqueName(todosLosDatos);
        filteredData = filteredData.filter(person => person.professorId !== excludeProfessorId);

        // Ordenar por sueldo
        filteredData.sort((a, b) => {
          const sueldoA = parsearMonto(a.sueldoActual || '$0');
          const sueldoB = parsearMonto(b.sueldoActual || '$0');
          return sueldoB - sueldoA;
        });

        const totalRegistros = filteredData.length;

        if (fetchAll) {
          return {
            success: true,
            data: filteredData.map(person => ({
              nombre: person.nombre,
              professorId: person.professorId,
              sueldoActual: person.sueldoActual,
              sujetoObligado: person.sujetoObligado,
              entidadFederativa: person.entidadFederativa,
              matchExacto: false
            })),
            paginador: {
              numeroPaginas: 1,
              cantidadPagina: totalRegistros,
              total: totalRegistros,
              paginaActual: 0,
              cantidadElementos: totalRegistros,
              hasMore: false
            }
          };
        }

        const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);
        const inicio = numeroPagina * cantidadPorPagina;
        const fin = inicio + cantidadPorPagina;
        const datosPaginados = filteredData.slice(inicio, fin);

        return {
          success: true,
          data: datosPaginados.map(person => ({
            nombre: person.nombre,
            professorId: person.professorId,
            sueldoActual: person.sueldoActual,
            sujetoObligado: person.sujetoObligado,
            entidadFederativa: person.entidadFederativa,
            matchExacto: false
          })),
          paginador: {
            numeroPaginas: totalPaginas,
            cantidadPagina: cantidadPorPagina,
            total: totalRegistros,
            paginaActual: numeroPagina,
            cantidadElementos: datosPaginados.length,
            hasMore: hasMore,
            // Datos reales del servidor de Transparencia
            totalEnServidor: totalRealServidor,
            paginasEnServidor: totalPaginas
          }
        };
      }

      return {
        success: true,
        data: [],
        paginador: {
          numeroPaginas: 0,
          cantidadPagina: cantidadPorPagina,
          total: 0,
          paginaActual: 0,
          cantidadElementos: 0,
          hasMore: false
        }
      };
    }

    // Consulta 1: Búsqueda específica con jsonAtributos (match exacto de apellidos)
    const jsonAtributos = buildJsonAtributosApellidos(apellidoPaterno, apellidoMaterno);
    const primeraConsultaEspecifica = await consultarTransparencia(targetUrl, {
      jsonAtributos,
      cantidad: 200,
      numeroPagina: 0
    });

    // Traer páginas de la consulta específica según el límite
    let datosEspecificos = [];
    let totalPaginasEspecificas = 0;
    let paginasTraidasEspecificas = 0;
    let totalRealEspecifico = 0;
    if (primeraConsultaEspecifica.success && primeraConsultaEspecifica.data.length > 0) {
      datosEspecificos = [...primeraConsultaEspecifica.data];
      const paginasEspecificas = primeraConsultaEspecifica.paginador?.numeroPaginas || 1;
      totalPaginasEspecificas = paginasEspecificas;
      totalRealEspecifico = primeraConsultaEspecifica.paginador?.total || 0;

      // Calcular cuántas páginas traer según el límite
      const paginasNecesarias = maxRecords > 0 ? Math.ceil(maxRecords / 200) : paginasEspecificas;
      const paginasATraer = Math.min(paginasNecesarias, paginasEspecificas);
      paginasTraidasEspecificas = paginasATraer;

      if (paginasATraer > 1) {
        console.log(`[${timestamp}] 🔄 Consulta específica: trayendo ${paginasATraer - 1} páginas adicionales (límite: ${maxRecords})...`);
        const promesas = [];
        for (let i = 1; i < paginasATraer; i++) {
          promesas.push(
            consultarTransparencia(targetUrl, {
              jsonAtributos,
              cantidad: 200,
              numeroPagina: i
            })
          );
        }
        const resultados = await Promise.all(promesas);
        resultados.forEach(r => {
          if (r.success && r.data.length > 0) {
            datosEspecificos.push(...r.data);
          }
        });
      }
    }

    // Consulta 2: Búsqueda general con texto plano (más resultados)
    const busquedaTexto = apellidoMaterno
      ? `${apellidoPaterno} ${apellidoMaterno}`
      : apellidoPaterno;

    const primeraConsultaGeneral = await consultarTransparencia(targetUrl, {
      contenido: busquedaTexto,
      cantidad: 200,
      numeroPagina: 0
    });

    // Traer páginas de la consulta general según el límite
    let datosGenerales = [];
    let totalPaginasGenerales = 0;
    let paginasTraidasGenerales = 0;
    let totalRealGeneral = 0;
    if (primeraConsultaGeneral.success && primeraConsultaGeneral.data.length > 0) {
      datosGenerales = [...primeraConsultaGeneral.data];
      const paginasGenerales = primeraConsultaGeneral.paginador?.numeroPaginas || 1;
      totalPaginasGenerales = paginasGenerales;
      totalRealGeneral = primeraConsultaGeneral.paginador?.total || 0;

      // Calcular cuántas páginas traer según el límite
      const paginasNecesarias = maxRecords > 0 ? Math.ceil(maxRecords / 200) : paginasGenerales;
      const paginasATraer = Math.min(paginasNecesarias, paginasGenerales);
      paginasTraidasGenerales = paginasATraer;

      if (paginasATraer > 1) {
        console.log(`[${timestamp}] 🔄 Consulta general: trayendo ${paginasATraer - 1} páginas adicionales (límite: ${maxRecords})...`);
        const promesas = [];
        for (let i = 1; i < paginasATraer; i++) {
          promesas.push(
            consultarTransparencia(targetUrl, {
              contenido: busquedaTexto,
              cantidad: 200,
              numeroPagina: i
            })
          );
        }
        const resultados = await Promise.all(promesas);
        resultados.forEach(r => {
          if (r.success && r.data.length > 0) {
            datosGenerales.push(...r.data);
          }
        });
      }
    }

    console.log(`[${timestamp}] 📊 Total traído: ${datosEspecificos.length} específicos, ${datosGenerales.length} generales`);

    // Determinar si hay más datos de los que trajimos
    const hasMore = (paginasTraidasEspecificas < totalPaginasEspecificas) || (paginasTraidasGenerales < totalPaginasGenerales);

    // Combinar resultados
    const todosLosDatos = [];
    const idsUnicos = new Set();

    // Agregar resultados específicos primero (match exacto)
    datosEspecificos.forEach(item => {
      if (!idsUnicos.has(item.id)) {
        todosLosDatos.push({ ...item, matchExacto: true });
        idsUnicos.add(item.id);
      }
    });

    // Agregar resultados generales (match parcial)
    datosGenerales.forEach(item => {
      if (!idsUnicos.has(item.id)) {
        todosLosDatos.push({ ...item, matchExacto: false });
        idsUnicos.add(item.id);
      }
    });

    if (todosLosDatos.length > 0) {
      // Filtrar datos por nombres únicos
      let filteredData = filterByUniqueName(todosLosDatos);

      // Excluir al profesor actual
      filteredData = filteredData.filter(person => person.professorId !== excludeProfessorId);

      // Ordenar: primero match exacto, luego por sueldo
      filteredData.sort((a, b) => {
        // Priorizar match exacto
        if (a.matchExacto && !b.matchExacto) return -1;
        if (!a.matchExacto && b.matchExacto) return 1;

        // Si ambos tienen el mismo tipo de match, ordenar por sueldo
        const sueldoA = parsearMonto(a.sueldoActual || '$0');
        const sueldoB = parsearMonto(b.sueldoActual || '$0');
        return sueldoB - sueldoA;
      });

      // Si fetchAll=true, retornar todos los datos sin paginación
      const totalRegistros = filteredData.length;

      if (fetchAll) {
        console.log(`[${timestamp}] 🚀 Retornando TODOS los ${totalRegistros} registros (sin paginación)`);
        return {
          success: true,
          data: filteredData.map(person => ({
            nombre: person.nombre,
            professorId: person.professorId,
            sueldoActual: person.sueldoActual,
            sujetoObligado: person.sujetoObligado,
            entidadFederativa: person.entidadFederativa,
            matchExacto: person.matchExacto || false
          })),
          paginador: {
            numeroPaginas: 1,
            cantidadPagina: totalRegistros,
            total: totalRegistros,
            paginaActual: 0,
            cantidadElementos: totalRegistros,
            hasMore: false
          }
        };
      }

      // Implementar paginación local sobre el conjunto combinado
      const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);
      const inicio = numeroPagina * cantidadPorPagina;
      const fin = inicio + cantidadPorPagina;
      const datosPaginados = filteredData.slice(inicio, fin);

      console.log(`[${timestamp}] ✅ Encontrados ${totalRegistros} personas con apellidos similares (${filteredData.filter(p => p.matchExacto).length} exactos) - Página ${numeroPagina + 1}/${totalPaginas}`);
      console.log(`[${timestamp}] 🔍 Hay más datos en servidor: ${hasMore ? 'SÍ' : 'NO'}`);

      return {
        success: true,
        data: datosPaginados.map(person => ({
          nombre: person.nombre,
          professorId: person.professorId,
          sueldoActual: person.sueldoActual,
          sujetoObligado: person.sujetoObligado,
          entidadFederativa: person.entidadFederativa,
          matchExacto: person.matchExacto || false
        })),
        paginador: {
          numeroPaginas: totalPaginas,
          cantidadPagina: cantidadPorPagina,
          total: totalRegistros,
          paginaActual: numeroPagina,
          cantidadElementos: datosPaginados.length,
          hasMore: hasMore,
          // Datos reales del servidor de Transparencia
          totalEnServidor: Math.max(totalRealEspecifico, totalRealGeneral),
          paginasEnServidor: Math.max(totalPaginasEspecificas, totalPaginasGenerales)
        }
      };
    }

    return {
      success: true,
      data: [],
      paginador: {
        numeroPaginas: 0,
        cantidadPagina: cantidadPorPagina,
        total: 0,
        paginaActual: 0,
        cantidadElementos: 0
      }
    };
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error al buscar por apellido:`, error);
    throw error;
  }
}

/**
 * Busca personas de la misma institución con paginación
 * @param {string} identificadorGrupo - ID del grupo de la institución
 * @param {string} idEntidadFederativa - ID de la entidad federativa
 * @param {string} sujetoObligado - Nombre del sujeto obligado
 * @param {string} targetUrl - URL del endpoint
 * @param {string} excludeProfessorId - ID del profesor a excluir
 * @param {number} numeroPagina - Número de página (0-indexed)
 * @param {boolean} fetchAll - Si true, retorna todos los datos sin paginación
 * @param {number} maxRecords - Límite máximo de registros a traer de Transparencia (0 = sin límite, default 5000)
 * @param {string} searchText - Texto de búsqueda para filtrar por nombre (opcional)
 * @returns {Promise<{success: boolean, data: Array, paginador: Object}>}
 */
export async function buscarPorInstitucion(identificadorGrupo, idEntidadFederativa, sujetoObligado, targetUrl, excludeProfessorId, numeroPagina = 0, fetchAll = false, maxRecords = 5000, searchText = '') {
  const timestamp = new Date().toISOString();
  const cantidadPorPagina = 10;

  console.log(`[${timestamp}] 🏛️ Buscando por institución: ${sujetoObligado.substring(0, 50)}...`);
  console.log(`[${timestamp}] 📋 ID Grupo: ${identificadorGrupo}`);
  console.log(`[${timestamp}] 📋 ID Entidad: ${idEntidadFederativa || 'No proporcionado'}`);
  console.log(`[${timestamp}] 📄 Página solicitada: ${numeroPagina}`);
  console.log(`[${timestamp}] 🎯 Límite de registros: ${maxRecords}`);
  console.log(`[${timestamp}] 🔍 Texto de búsqueda: ${searchText || 'ninguno'}`);

  try {
    const { consultarTransparencia, buildJsonAtributosInstitucion } = await import('./transparenciaClient.js');

    // Construir jsonAtributos con la institución
    const jsonAtributos = buildJsonAtributosInstitucion(identificadorGrupo, sujetoObligado, idEntidadFederativa);

    // Preparar parámetros de búsqueda
    const searchParams = {
      jsonAtributos,
      cantidad: 200,
      numeroPagina: 0
    };

    // Si hay texto de búsqueda, agregarlo como contenido
    if (searchText && searchText.trim()) {
      searchParams.contenido = searchText.trim();
    }

    // Primera consulta para obtener el total y la primera página
    const primeraConsulta = await consultarTransparencia(targetUrl, searchParams);

    if (!primeraConsulta.success) {
      return {
        success: true,
        data: [],
        paginador: {
          numeroPaginas: 0,
          cantidadPagina: cantidadPorPagina,
          total: 0,
          paginaActual: numeroPagina,
          cantidadElementos: 0
        }
      };
    }

    const totalEnServidor = primeraConsulta.paginador?.total || primeraConsulta.data.length;
    const paginasEnServidor = primeraConsulta.paginador?.numeroPaginas || 1;
    let todosLosDatos = [...primeraConsulta.data];

    console.log(`[${timestamp}] 📊 Total en servidor: ${totalEnServidor}, Páginas: ${paginasEnServidor}`);

    // Calcular cuántas páginas traer según el límite maxRecords
    const paginasNecesarias = maxRecords > 0 ? Math.ceil(maxRecords / 200) : paginasEnServidor;
    const paginasATraer = Math.min(paginasNecesarias, paginasEnServidor);

    // Si hay más páginas en el servidor, traerlas según el límite
    if (paginasATraer > 1) {
      console.log(`[${timestamp}] 🔄 Trayendo ${paginasATraer - 1} páginas adicionales (límite: ${maxRecords} registros)...`);

      const promesas = [];
      for (let i = 1; i < paginasATraer; i++) {
        const params = {
          jsonAtributos,
          cantidad: 200,
          numeroPagina: i
        };
        // Agregar texto de búsqueda si existe
        if (searchText && searchText.trim()) {
          params.contenido = searchText.trim();
        }
        promesas.push(consultarTransparencia(targetUrl, params));
      }

      const resultadosAdicionales = await Promise.all(promesas);
      resultadosAdicionales.forEach(resultado => {
        if (resultado.success && resultado.data.length > 0) {
          todosLosDatos.push(...resultado.data);
        }
      });

      console.log(`[${timestamp}] ✅ Total datos traídos: ${todosLosDatos.length} (límite aplicado)`);
    }

    // Filtrar datos por nombres únicos
    let filteredData = filterByUniqueName(todosLosDatos);

    // Excluir al profesor actual
    filteredData = filteredData.filter(person => person.professorId !== excludeProfessorId);

    // Ordenar por sueldo actual de mayor a menor
    filteredData.sort((a, b) => {
      const sueldoA = parsearMonto(a.sueldoActual || '$0');
      const sueldoB = parsearMonto(b.sueldoActual || '$0');
      return sueldoB - sueldoA;
    });

    // Determinar si hay más datos en el servidor de los que trajimos
    const hasMore = paginasATraer < paginasEnServidor;

    // Si fetchAll=true, retornar todos los datos sin paginación
    const totalRegistros = filteredData.length;

    if (fetchAll) {
      console.log(`[${timestamp}] 🚀 Retornando TODOS los ${totalRegistros} registros (sin paginación)`);
      return {
        success: true,
        data: filteredData.map(person => ({
          nombre: person.nombre,
          professorId: person.professorId,
          sueldoActual: person.sueldoActual,
          sujetoObligado: person.sujetoObligado,
          entidadFederativa: person.entidadFederativa
        })),
        paginador: {
          numeroPaginas: 1,
          cantidadPagina: totalRegistros,
          total: totalRegistros,
          paginaActual: 0,
          cantidadElementos: totalRegistros,
          hasMore: false
        }
      };
    }

    // Implementar paginación local sobre los resultados filtrados
    const totalPaginas = Math.ceil(totalRegistros / cantidadPorPagina);
    const inicio = numeroPagina * cantidadPorPagina;
    const fin = inicio + cantidadPorPagina;
    const datosPaginados = filteredData.slice(inicio, fin);

    console.log(`[${timestamp}] ✅ Encontrados ${datosPaginados.length} personas en página ${numeroPagina + 1}/${totalPaginas}`);
    console.log(`[${timestamp}] 📊 Total de registros filtrados: ${totalRegistros} de ${todosLosDatos.length} originales`);
    console.log(`[${timestamp}] 🔍 Hay más datos en servidor: ${hasMore ? 'SÍ' : 'NO'}`);

    return {
      success: true,
      data: datosPaginados.map(person => ({
        nombre: person.nombre,
        professorId: person.professorId,
        sueldoActual: person.sueldoActual,
        sujetoObligado: person.sujetoObligado,
        entidadFederativa: person.entidadFederativa
      })),
      paginador: {
        numeroPaginas: totalPaginas,
        cantidadPagina: cantidadPorPagina,
        total: totalRegistros,
        paginaActual: numeroPagina,
        cantidadElementos: datosPaginados.length,
        hasMore: hasMore,
        // Datos reales del servidor de Transparencia
        totalEnServidor: totalEnServidor,
        paginasEnServidor: paginasEnServidor
      }
    };
  } catch (error) {
    console.error(`[${timestamp}] ❌ Error al buscar por institución:`, error);
    throw error;
  }
}
