// Funciones para manejar analytics y estadísticas
import { executeRawQuery } from './database.js';

/**
 * Obtiene los nombres más buscados
 * @param {number} limit - Número de resultados (default: 10)
 */
export async function getNombresMasBuscados(limit = 10) {
  try {
    const limitNum = parseInt(limit) || 10;
    
    // Query con LIMIT para resultados paginados
    const query = `
      SELECT 
        nombre_profesor,
        COUNT(*) as total_busquedas,
        COUNT(DISTINCT sid) as usuarios_unicos,
        MAX(timestamp) as ultima_busqueda
      FROM consultas_log
      WHERE nombre_profesor IS NOT NULL
        AND nombre_profesor != ''
      GROUP BY nombre_profesor
      ORDER BY total_busquedas DESC
      LIMIT ?
    `;
    
    // Query para obtener el total real de registros (sin LIMIT)
    const countQuery = `
      SELECT COUNT(DISTINCT nombre_profesor) as total_real
      FROM consultas_log
      WHERE nombre_profesor IS NOT NULL
        AND nombre_profesor != ''
    `;
    
    const [results, countResults] = await Promise.all([
      executeRawQuery(query, [limitNum]),
      executeRawQuery(countQuery)
    ]);
    
    return {
      success: true,
      data: results,
      total: results.length,
      totalReal: countResults[0].total_real,
      limit: limit
    };
  } catch (error) {
    console.error('❌ Error al obtener nombres más buscados:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas de búsquedas',
      detail: error.message
    };
  }
}

/**
 * Obtiene los profesores más clickeados (más vistas en sus cards)
 * @param {number} limit - Número de resultados (default: 10)
 */
export async function getProfesoresMasClickeados(limit = 10) {
  try {
    const limitNum = parseInt(limit) || 10;
    
    // Query con LIMIT para resultados paginados
    const query = `
      SELECT 
        nombre_profesor,
        sujeto_obligado,
        entidad_federativa,
        COUNT(*) as total_vistas,
        COUNT(DISTINCT sid) as usuarios_unicos,
        AVG(sueldo_maximo) as promedio_sueldo_maximo,
        AVG(sueldo_acumulado) as promedio_sueldo_acumulado,
        MAX(timestamp) as ultima_vista
      FROM profesor_vistas
      WHERE nombre_profesor IS NOT NULL
        AND nombre_profesor != ''
      GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ORDER BY total_vistas DESC
      LIMIT ?
    `;
    
    // Query para obtener el total real de combinaciones únicas (sin LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total_real
      FROM (
        SELECT nombre_profesor, sujeto_obligado, entidad_federativa
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as unique_professors
    `;
    
    // Query para obtener el total acumulado de vistas de todos los profesores
    const totalVistasQuery = `
      SELECT SUM(total_vistas) as total_vistas_acumuladas
      FROM (
        SELECT COUNT(*) as total_vistas
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as vistas_por_profesor
    `;
    
    const [results, countResults, totalVistasResults] = await Promise.all([
      executeRawQuery(query, [limitNum]),
      executeRawQuery(countQuery),
      executeRawQuery(totalVistasQuery)
    ]);
    
    // Formatear los resultados
    const formattedResults = results.map(row => ({
      nombreProfesor: row.nombre_profesor,
      sujetoObligado: row.sujeto_obligado,
      entidadFederativa: row.entidad_federativa,
      totalVistas: row.total_vistas,
      usuariosUnicos: row.usuarios_unicos,
      promedioSueldoMaximo: parseFloat(row.promedio_sueldo_maximo || 0).toFixed(2),
      promedioSueldoAcumulado: parseFloat(row.promedio_sueldo_acumulado || 0).toFixed(2),
      ultimaVista: row.ultima_vista
    }));
    
    return {
      success: true,
      data: formattedResults,
      total: formattedResults.length,
      totalReal: countResults[0].total_real,
      totalVistasAcumuladas: totalVistasResults[0].total_vistas_acumuladas || 0,
      limit: limit
    };
  } catch (error) {
    console.error('❌ Error al obtener profesores más clickeados:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas de vistas',
      detail: error.message
    };
  }
}

/**
 * Obtiene los profesores con mayor sueldo acumulado
 * @param {number} limit - Número de resultados (default: 10)
 */
export async function getProfesoresTopSueldoAcumulado(limit = 10) {
  try {
    const limitNum = parseInt(limit) || 10;
    
    // Query con LIMIT para resultados paginados
    const query = `
      SELECT 
        nombre_profesor,
        sujeto_obligado,
        entidad_federativa,
        MAX(sueldo_acumulado) as sueldo_acumulado_max,
        MAX(sueldo_maximo) as sueldo_maximo,
        MAX(ultimo_sueldo) as ultimo_sueldo,
        COUNT(*) as total_vistas,
        MAX(timestamp) as ultima_vista
      FROM profesor_vistas
      WHERE nombre_profesor IS NOT NULL
        AND nombre_profesor != ''
        AND sueldo_acumulado > 0
      GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ORDER BY sueldo_acumulado_max DESC
      LIMIT ?
    `;
    
    // Query para obtener el total real de profesores con sueldo > 0 (sin LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total_real
      FROM (
        SELECT nombre_profesor, sujeto_obligado, entidad_federativa
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
          AND sueldo_acumulado > 0
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as unique_professors
    `;
    
    // Query para obtener el total acumulado de vistas de profesores con sueldo > 0
    const totalVistasQuery = `
      SELECT SUM(total_vistas) as total_vistas_acumuladas
      FROM (
        SELECT COUNT(*) as total_vistas
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
          AND sueldo_acumulado > 0
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as vistas_por_profesor
    `;
    
    const [results, countResults, totalVistasResults] = await Promise.all([
      executeRawQuery(query, [limitNum]),
      executeRawQuery(countQuery),
      executeRawQuery(totalVistasQuery)
    ]);
    
    // Formatear los resultados
    const formattedResults = results.map(row => ({
      nombreProfesor: row.nombre_profesor,
      sujetoObligado: row.sujeto_obligado,
      entidadFederativa: row.entidad_federativa,
      sueldoAcumulado: parseFloat(row.sueldo_acumulado_max || 0).toFixed(2),
      sueldoMaximo: parseFloat(row.sueldo_maximo || 0).toFixed(2),
      ultimoSueldo: parseFloat(row.ultimo_sueldo || 0).toFixed(2),
      totalVistas: row.total_vistas,
      ultimaVista: row.ultima_vista
    }));
    
    return {
      success: true,
      data: formattedResults,
      total: formattedResults.length,
      totalReal: countResults[0].total_real,
      totalVistasAcumuladas: totalVistasResults[0].total_vistas_acumuladas || 0,
      limit: limit,
      tipo: 'mayores'
    };
  } catch (error) {
    console.error('❌ Error al obtener top sueldos acumulados:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas de sueldos',
      detail: error.message
    };
  }
}

/**
 * Obtiene los profesores con menor sueldo acumulado (excluyendo 0)
 * @param {number} limit - Número de resultados (default: 10)
 */
export async function getProfesoresBottomSueldoAcumulado(limit = 10) {
  try {
    const limitNum = parseInt(limit) || 10;
    
    // Query con LIMIT para resultados paginados
    const query = `
      SELECT 
        nombre_profesor,
        sujeto_obligado,
        entidad_federativa,
        MIN(sueldo_acumulado) as sueldo_acumulado_min,
        MAX(sueldo_maximo) as sueldo_maximo,
        MAX(ultimo_sueldo) as ultimo_sueldo,
        COUNT(*) as total_vistas,
        MAX(timestamp) as ultima_vista
      FROM profesor_vistas
      WHERE nombre_profesor IS NOT NULL
        AND nombre_profesor != ''
        AND sueldo_acumulado > 0
      GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ORDER BY sueldo_acumulado_min ASC
      LIMIT ?
    `;
    
    // Query para obtener el total real de profesores con sueldo > 0 (sin LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total_real
      FROM (
        SELECT nombre_profesor, sujeto_obligado, entidad_federativa
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
          AND sueldo_acumulado > 0
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as unique_professors
    `;
    
    // Query para obtener el total acumulado de vistas de profesores con sueldo > 0
    const totalVistasQuery = `
      SELECT SUM(total_vistas) as total_vistas_acumuladas
      FROM (
        SELECT COUNT(*) as total_vistas
        FROM profesor_vistas
        WHERE nombre_profesor IS NOT NULL
          AND nombre_profesor != ''
          AND sueldo_acumulado > 0
        GROUP BY nombre_profesor, sujeto_obligado, entidad_federativa
      ) as vistas_por_profesor
    `;
    
    const [results, countResults, totalVistasResults] = await Promise.all([
      executeRawQuery(query, [limitNum]),
      executeRawQuery(countQuery),
      executeRawQuery(totalVistasQuery)
    ]);
    
    // Formatear los resultados
    const formattedResults = results.map(row => ({
      nombreProfesor: row.nombre_profesor,
      sujetoObligado: row.sujeto_obligado,
      entidadFederativa: row.entidad_federativa,
      sueldoAcumulado: parseFloat(row.sueldo_acumulado_min || 0).toFixed(2),
      sueldoMaximo: parseFloat(row.sueldo_maximo || 0).toFixed(2),
      ultimoSueldo: parseFloat(row.ultimo_sueldo || 0).toFixed(2),
      totalVistas: row.total_vistas,
      ultimaVista: row.ultima_vista
    }));
    
    return {
      success: true,
      data: formattedResults,
      total: formattedResults.length,
      totalReal: countResults[0].total_real,
      totalVistasAcumuladas: totalVistasResults[0].total_vistas_acumuladas || 0,
      limit: limit,
      tipo: 'menores'
    };
  } catch (error) {
    console.error('❌ Error al obtener bottom sueldos acumulados:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas de sueldos',
      detail: error.message
    };
  }
}

/**
 * Obtiene estadísticas generales del sistema
 */
export async function getEstadisticasGenerales() {
  try {
    // Total de búsquedas
    const [totalBusquedas] = await executeRawQuery(
      'SELECT COUNT(*) as total FROM consultas_log'
    );
    
    // Total de vistas de profesores
    const [totalVistas] = await executeRawQuery(
      'SELECT COUNT(*) as total FROM profesor_vistas'
    );
    
    // Total de usuarios únicos
    const [usuariosUnicos] = await executeRawQuery(
      'SELECT COUNT(DISTINCT sid) as total FROM usuarios_nuevos'
    );
    
    // Búsquedas últimas 24 horas
    const [busquedasRecientes] = await executeRawQuery(
      `SELECT COUNT(*) as total FROM consultas_log 
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    
    // Vistas últimas 24 horas
    const [vistasRecientes] = await executeRawQuery(
      `SELECT COUNT(*) as total FROM profesor_vistas 
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    
    // Usuarios nuevos últimas 24 horas
    const [usuariosNuevosRecientes] = await executeRawQuery(
      `SELECT COUNT(*) as total FROM usuarios_nuevos 
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    
    return {
      success: true,
      data: {
        totales: {
          busquedas: totalBusquedas.total,
          vistas: totalVistas.total,
          usuariosUnicos: usuariosUnicos.total
        },
        ultimas24Horas: {
          busquedas: busquedasRecientes.total,
          vistas: vistasRecientes.total,
          usuariosNuevos: usuariosNuevosRecientes.total
        }
      }
    };
  } catch (error) {
    console.error('❌ Error al obtener estadísticas generales:', error);
    return {
      success: false,
      error: 'Error al obtener estadísticas generales',
      detail: error.message
    };
  }
}
