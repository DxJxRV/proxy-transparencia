/**
 * Cliente genérico para consultas a la API de Transparencia
 * Estandariza todas las peticiones y maneja la paginación
 */

/**
 * @typedef {Object} JsonAtributos
 * @property {string|null} idEntidadFederativa - ID de la entidad federativa
 * @property {Object|null} idSujetoObligado - Objeto con id y nombre del sujeto obligado
 * @property {string} idSujetoObligado.id - ID del sujeto obligado
 * @property {string} idSujetoObligado.nombre - Nombre del sujeto obligado
 * @property {string} nombre - Nombre de la persona
 * @property {string} primerApellido - Primer apellido
 * @property {string} segundoApellido - Segundo apellido
 * @property {string} denominacionCargo - Denominación del cargo
 * @property {number|null} montoNetoRangoInicial - Monto neto inicial del rango
 * @property {number|null} montoNetoRangoFinal - Monto neto final del rango
 */

/**
 * @typedef {Object} ConsultaParams
 * @property {string} [contenido=''] - Texto de búsqueda libre
 * @property {number} [cantidad=20] - Cantidad de resultados por página
 * @property {number} [numeroPagina=0] - Número de página (0-indexed)
 * @property {JsonAtributos} [jsonAtributos=null] - Atributos específicos de búsqueda
 * @property {string} [tipoOrdenamiento='COINCIDENCIA'] - Tipo de ordenamiento
 * @property {boolean} [dePaginador=false] - Si viene de paginador
 */

/**
 * @typedef {Object} Paginador
 * @property {number} numeroPaginas - Número total de páginas
 * @property {number} cantidadPagina - Cantidad de elementos por página
 * @property {number} total - Total de elementos encontrados
 * @property {number} paginaActual - Página actual (0-indexed)
 * @property {number} cantidadElementos - Cantidad de elementos en la página actual
 */

/**
 * @typedef {Object} GrupoInfo
 * @property {string} identificadorGrupo - ID del grupo
 * @property {string} nombreGrupo - Nombre del grupo
 * @property {number} cantidadEncontrada - Cantidad encontrada
 * @property {number|null} orden - Orden
 */

/**
 * @typedef {Object} TransparenciaResponse
 * @property {boolean} success - Indica si la consulta fue exitosa
 * @property {Array<Object>} data - Array de personas encontradas
 * @property {Paginador} paginador - Información de paginación
 * @property {Array<GrupoInfo>} organosGarantes - Órganos garantes disponibles
 * @property {Array<GrupoInfo>} sujetosObligados - Sujetos obligados disponibles
 * @property {Array<GrupoInfo>} anioFechaInicio - Años disponibles
 */

/**
 * Realiza una consulta genérica a la API de Transparencia
 * @param {string} targetUrl - URL del endpoint de transparencia
 * @param {ConsultaParams} params - Parámetros de la consulta
 * @returns {Promise<TransparenciaResponse>}
 */
export async function consultarTransparencia(targetUrl, params = {}) {
  const timestamp = new Date().toISOString();

  // Parámetros por defecto
  const {
    contenido = '',
    cantidad = 20,
    numeroPagina = 0,
    jsonAtributos = null,
    tipoOrdenamiento = 'COINCIDENCIA',
    dePaginador = false
  } = params;

  console.log(`[${timestamp}] 🔍 Consulta genérica a Transparencia`);
  console.log(`[${timestamp}] 📄 Página: ${numeroPagina}, Cantidad: ${cantidad}`);

  try {
    // Construir el request body estándar
    const requestBody = {
      contenido,
      cantidad,
      numeroPagina,
      coleccion: 'SUELDOS',
      dePaginador,
      idCompartido: '',
      filtroSeleccionado: '',
      tipoOrdenamiento,
      sujetosObligados: { seleccion: [], descartado: [] },
      organosGarantes: { seleccion: [], descartado: [] },
      anioFechaInicio: { seleccion: [], descartado: [] }
    };

    // Agregar jsonAtributos solo si se proporciona
    if (jsonAtributos) {
      requestBody.jsonAtributos = jsonAtributos;
    }

    console.log(`[${timestamp}] 📤 Payload enviado:`);
    console.log(JSON.stringify(requestBody, null, 2));

    // Hacer la petición
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://tematicos.plataformadetransparencia.org.mx',
        'referer': 'https://tematicos.plataformadetransparencia.org.mx/'
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    const data = JSON.parse(text);

    console.log(`[${timestamp}] 📥 Response recibido`);

    // Validar estructura de respuesta
    if (!data.paylod) {
      console.error(`[${timestamp}] ❌ Respuesta inválida: no contiene paylod`);
      return {
        success: false,
        data: [],
        paginador: {
          numeroPaginas: 0,
          cantidadPagina: cantidad,
          total: 0,
          paginaActual: numeroPagina,
          cantidadElementos: 0
        },
        organosGarantes: [],
        sujetosObligados: [],
        anioFechaInicio: []
      };
    }

    const { paylod } = data;
    const datosSolr = paylod.datosSolr || [];
    const paginador = paylod.paginador || {
      numeroPaginas: 0,
      cantidadPagina: cantidad,
      total: 0,
      paginaActual: numeroPagina,
      cantidadElementos: datosSolr.length
    };

    console.log(`[${timestamp}] ✅ Encontrados ${datosSolr.length} resultados`);
    console.log(`[${timestamp}] 📊 Paginación: ${paginador.paginaActual + 1}/${paginador.numeroPaginas} (Total: ${paginador.total})`);

    return {
      success: true,
      data: datosSolr,
      paginador,
      organosGarantes: paylod.organosGarantes || [],
      sujetosObligados: paylod.sujetosObligados || [],
      anioFechaInicio: paylod.anioFechaInicio || []
    };

  } catch (error) {
    console.error(`[${timestamp}] ❌ Error en consulta a Transparencia:`, error);
    throw error;
  }
}

/**
 * Helper: Construye jsonAtributos para búsqueda por apellidos
 * @param {string} primerApellido - Primer apellido
 * @param {string} [segundoApellido=''] - Segundo apellido
 * @returns {JsonAtributos}
 */
export function buildJsonAtributosApellidos(primerApellido, segundoApellido = '') {
  return {
    idEntidadFederativa: null,
    idSujetoObligado: null,
    nombre: '',
    primerApellido,
    segundoApellido,
    denominacionCargo: '',
    montoNetoRangoInicial: null,
    montoNetoRangoFinal: null
  };
}

/**
 * Helper: Construye jsonAtributos para búsqueda por institución
 * @param {string} identificadorGrupo - ID del grupo de la institución
 * @param {string} nombreInstitucion - Nombre de la institución
 * @param {string} [idEntidadFederativa=null] - ID de la entidad federativa
 * @returns {JsonAtributos}
 */
export function buildJsonAtributosInstitucion(identificadorGrupo, nombreInstitucion, idEntidadFederativa = null) {
  const jsonAtributos = {
    idSujetoObligado: {
      id: identificadorGrupo,
      nombre: nombreInstitucion
    },
    nombre: '',
    primerApellido: '',
    segundoApellido: '',
    denominacionCargo: '',
    montoNetoRangoInicial: null,
    montoNetoRangoFinal: null
  };

  if (idEntidadFederativa) {
    jsonAtributos.idEntidadFederativa = idEntidadFederativa;
  }

  return jsonAtributos;
}

/**
 * Helper: Construye jsonAtributos para búsqueda por nombre
 * @param {string} nombre - Nombre de la persona
 * @returns {JsonAtributos}
 */
export function buildJsonAtributosNombre(nombre) {
  return {
    idEntidadFederativa: null,
    idSujetoObligado: null,
    nombre,
    primerApellido: '',
    segundoApellido: '',
    denominacionCargo: '',
    montoNetoRangoInicial: null,
    montoNetoRangoFinal: null
  };
}
