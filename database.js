import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootroot',
  database: process.env.DB_NAME || 'transparencia_db'
};

let pool = null;

/**
 * Inicializa la base de datos y el pool de conexiones
 */
export async function initDatabase() {
  try {
    console.log('🔄 Conectando a MySQL...');
    
    // Primero nos conectamos sin especificar la base de datos
    const connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    // Intentar crear la base de datos si no existe
    console.log(`🔧 Creando base de datos '${DB_CONFIG.database}' si no existe...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Base de datos '${DB_CONFIG.database}' lista`);
    
    await connection.end();

    // Ahora creamos el pool con la base de datos especificada
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Verificar la conexión
    const testConnection = await pool.getConnection();
    console.log('✅ Pool de conexiones creado exitosamente');
    testConnection.release();

    // Crear las tablas necesarias
    await createTables();

    // Ejecutar migraciones para agregar columnas UTM a tablas existentes
    await migrateUtmColumns();

    return pool;
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
}

/**
 * Migra columnas UTM en tablas existentes
 */
async function migrateUtmColumns() {
  try {
    console.log('🔧 Verificando/agregando columnas UTM...');

    // Verificar si la columna utm_source ya existe en usuarios_nuevos
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'usuarios_nuevos'
      AND COLUMN_NAME = 'utm_source'
    `, [DB_CONFIG.database]);

    if (columns.length === 0) {
      // Agregar columnas UTM a usuarios_nuevos
      console.log('➕ Agregando columnas UTM a usuarios_nuevos...');
      await pool.query(`
        ALTER TABLE usuarios_nuevos
        ADD COLUMN utm_source VARCHAR(255) COMMENT 'Parámetro src o utm_source',
        ADD COLUMN utm_medium VARCHAR(255) COMMENT 'Parámetro utm_medium',
        ADD COLUMN utm_campaign VARCHAR(255) COMMENT 'Parámetro utm_campaign',
        ADD COLUMN utm_content VARCHAR(255) COMMENT 'Parámetro utm_content',
        ADD COLUMN utm_term VARCHAR(255) COMMENT 'Parámetro utm_term',
        ADD INDEX idx_utm_source (utm_source)
      `);
      console.log('✅ Columnas UTM agregadas a usuarios_nuevos');
    } else {
      console.log('✓ Columnas UTM ya existen en usuarios_nuevos');
    }

    // Verificar consultas_log
    const [consultasColumns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'consultas_log'
      AND COLUMN_NAME = 'utm_source'
    `, [DB_CONFIG.database]);

    if (consultasColumns.length === 0) {
      console.log('➕ Agregando columna utm_source a consultas_log...');
      await pool.query(`
        ALTER TABLE consultas_log
        ADD COLUMN utm_source VARCHAR(255) COMMENT 'Origen UTM del usuario',
        ADD INDEX idx_utm_source (utm_source)
      `);
      console.log('✅ Columna utm_source agregada a consultas_log');
    } else {
      console.log('✓ Columna utm_source ya existe en consultas_log');
    }

    // Verificar profesor_vistas
    const [vistasColumns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'profesor_vistas'
      AND COLUMN_NAME = 'utm_source'
    `, [DB_CONFIG.database]);

    if (vistasColumns.length === 0) {
      console.log('➕ Agregando columna utm_source a profesor_vistas...');
      await pool.query(`
        ALTER TABLE profesor_vistas
        ADD COLUMN utm_source VARCHAR(255) COMMENT 'Origen UTM del usuario',
        ADD INDEX idx_utm_source (utm_source)
      `);
      console.log('✅ Columna utm_source agregada a profesor_vistas');
    } else {
      console.log('✓ Columna utm_source ya existe en profesor_vistas');
    }

    console.log('✅ Migración de columnas UTM completada');
  } catch (error) {
    console.error('❌ Error en migración de columnas UTM:', error);
    // No lanzamos el error para no detener el inicio del servidor
  }
}

/**
 * Crea las tablas necesarias si no existen
 */
async function createTables() {
  try {
    console.log('🔧 Creando tablas si no existen...');
    
    // Tabla para registrar peticiones de usuarios nuevos (logger middleware)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios_nuevos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sid VARCHAR(36) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        method VARCHAR(10),
        path VARCHAR(500),
        utm_source VARCHAR(255) COMMENT 'Parámetro src o utm_source',
        utm_medium VARCHAR(255) COMMENT 'Parámetro utm_medium',
        utm_campaign VARCHAR(255) COMMENT 'Parámetro utm_campaign',
        utm_content VARCHAR(255) COMMENT 'Parámetro utm_content',
        utm_term VARCHAR(255) COMMENT 'Parámetro utm_term',
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_ip (ip_address),
        INDEX idx_method (method),
        INDEX idx_utm_source (utm_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Aquí agregaremos las definiciones de tablas según las necesites
    // Por ahora solo creamos una tabla de ejemplo para logs de consultas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultas_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sid VARCHAR(36),
        nombre_profesor VARCHAR(255),
        entidad_federativa VARCHAR(100),
        total_registros INT,
        registros_filtrados INT,
        duracion_ms INT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        utm_source VARCHAR(255) COMMENT 'Origen UTM del usuario',
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_entidad (entidad_federativa),
        INDEX idx_nombre (nombre_profesor),
        INDEX idx_ip (ip_address),
        INDEX idx_utm_source (utm_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla para registrar vistas de cards de profesores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profesor_vistas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sid VARCHAR(36),
        profesor_id VARCHAR(100),
        nombre_profesor VARCHAR(255),
        sujeto_obligado TEXT,
        entidad_federativa VARCHAR(100),
        sueldo_maximo DECIMAL(15, 2),
        sueldo_acumulado DECIMAL(15, 2),
        ultimo_sueldo DECIMAL(15, 2),
        ip_address VARCHAR(45),
        user_agent TEXT,
        utm_source VARCHAR(255) COMMENT 'Origen UTM del usuario',
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_profesor_id (profesor_id),
        INDEX idx_nombre (nombre_profesor),
        INDEX idx_entidad (entidad_federativa),
        INDEX idx_ip (ip_address),
        INDEX idx_utm_source (utm_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla para configuraciones de mensajes personalizados por UTM/src
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utm_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utm_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'src o utm_source value',
        title VARCHAR(500) NOT NULL COMMENT 'Título personalizado',
        subtitle VARCHAR(500) COMMENT 'Subtítulo opcional',
        button_text VARCHAR(255) COMMENT 'Texto del botón de búsqueda',
        suggested_name VARCHAR(255) COMMENT 'Nombre de profesor sugerido para prellenar',
        suggested_professor_id VARCHAR(100) COMMENT 'ID del profesor (si existe)',
        special_message TEXT COMMENT 'Mensaje especial adicional',
        background_color VARCHAR(50) COMMENT 'Color de fondo personalizado (hex)',
        text_color VARCHAR(50) COMMENT 'Color de texto personalizado (hex)',
        image_url VARCHAR(1000) COMMENT 'URL de imagen personalizada',
        is_active BOOLEAN DEFAULT TRUE COMMENT 'Si está activa la configuración',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        click_count INT DEFAULT 0 COMMENT 'Contador de clicks desde este UTM',
        view_count INT DEFAULT 0 COMMENT 'Contador de vistas con este UTM',
        INDEX idx_utm_key (utm_key),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla para mensajes dirigidos a usuarios que vinieron de UTMs específicos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS utm_targeted_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utm_key VARCHAR(255) NOT NULL COMMENT 'UTM al que está dirigido el mensaje',
        title VARCHAR(500) NOT NULL COMMENT 'Título del mensaje',
        subtitle VARCHAR(500) COMMENT 'Subtítulo opcional',
        message TEXT NOT NULL COMMENT 'Mensaje personalizado',
        background_color VARCHAR(50) COMMENT 'Color de fondo del mensaje',
        text_color VARCHAR(50) COMMENT 'Color de texto',
        button_text VARCHAR(255) COMMENT 'Texto del botón CTA',
        button_url VARCHAR(1000) COMMENT 'URL del botón CTA',
        start_date DATETIME NOT NULL COMMENT 'Fecha de inicio de visualización',
        end_date DATETIME NOT NULL COMMENT 'Fecha de fin de visualización',
        is_active BOOLEAN DEFAULT TRUE COMMENT 'Si está activo el mensaje',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        show_count INT DEFAULT 0 COMMENT 'Contador de veces mostrado',
        click_count INT DEFAULT 0 COMMENT 'Contador de clicks en el CTA',
        INDEX idx_utm_key (utm_key),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Tablas creadas/verificadas exitosamente');
  } catch (error) {
    console.error('❌ Error al crear las tablas:', error);
    throw error;
  }
}

/**
 * Obtiene una conexión del pool
 */
export function getPool() {
  if (!pool) {
    throw new Error('El pool de base de datos no ha sido inicializado. Llama a initDatabase() primero.');
  }
  return pool;
}

/**
 * Cierra el pool de conexiones
 */
export async function closeDatabase() {
  if (pool) {
    console.log('🔄 Cerrando conexiones a la base de datos...');
    await pool.end();
    pool = null;
    console.log('✅ Conexiones cerradas');
  }
}

/**
 * Ejecuta una query con manejo de errores
 */
export async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('❌ Error al ejecutar query:', error);
    throw error;
  }
}

/**
 * Ejecuta una query sin prepared statements (para queries con LIMIT dinámico)
 */
export async function executeRawQuery(query, params = []) {
  try {
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    console.error('❌ Error al ejecutar query:', error);
    throw error;
  }
}

/**
 * Registra una consulta en el log
 */
export async function logConsulta(sid, nombreProfesor, entidadFederativa, totalRegistros, registrosFiltrados, duracionMs, ipAddress, userAgent, utmSource = null) {
  try {
    await executeQuery(
      `INSERT INTO consultas_log
       (sid, nombre_profesor, entidad_federativa, total_registros, registros_filtrados, duracion_ms, ip_address, user_agent, utm_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid || null, nombreProfesor || null, entidadFederativa || null, totalRegistros, registrosFiltrados, duracionMs, ipAddress || null, userAgent || null, utmSource]
    );
  } catch (error) {
    console.error('⚠️ Error al registrar consulta en log:', error);
    // No lanzamos el error para no afectar la respuesta principal
  }
}

/**
 * Extrae la IP real del cliente considerando proxies
 */
export function getClientIp(req) {
  // Verificar headers comunes de proxies/load balancers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for puede contener múltiples IPs separadas por coma
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  // Fallback a la IP de la conexión directa
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Extrae el User Agent del request
 */
export function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Registra una vista de card de profesor
 */
export async function logProfesorVista(sid, profesorId, nombreProfesor, sujetoObligado, entidadFederativa, sueldoMaximo, sueldoAcumulado, ultimoSueldo, ipAddress, userAgent, utmSource = null) {
  try {
    await executeQuery(
      `INSERT INTO profesor_vistas
       (sid, profesor_id, nombre_profesor, sujeto_obligado, entidad_federativa, sueldo_maximo, sueldo_acumulado, ultimo_sueldo, ip_address, user_agent, utm_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sid || null,
        profesorId || null,
        nombreProfesor || null,
        sujetoObligado || null,
        entidadFederativa || null,
        sueldoMaximo || null,
        sueldoAcumulado || null,
        ultimoSueldo || null,
        ipAddress || null,
        userAgent || null,
        utmSource
      ]
    );
  } catch (error) {
    console.error('⚠️ Error al registrar vista de profesor:', error);
    // No lanzamos el error para no afectar la respuesta principal
  }
}

/**
 * Obtiene el UTM source de un usuario basándose en su SID
 */
export async function getUtmSourceBySid(sid) {
  try {
    const results = await executeQuery(
      `SELECT utm_source FROM usuarios_nuevos WHERE sid = ? AND utm_source IS NOT NULL LIMIT 1`,
      [sid]
    );
    return results.length > 0 ? results[0].utm_source : null;
  } catch (error) {
    console.error('⚠️ Error al obtener UTM por SID:', error);
    return null;
  }
}

/**
 * Registra un usuario nuevo desde el logger middleware
 */
export async function logUsuarioNuevo(sid, ipAddress, userAgent, method, path, utmParams = {}) {
  try {
    // Debug: Log de los parámetros recibidos
    if (utmParams && utmParams.utm_source) {
      console.log('💾 Guardando usuario nuevo con UTM:', {
        sid: sid.substring(0, 8) + '...',
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign
      });
    }

    await executeQuery(
      `INSERT INTO usuarios_nuevos
       (sid, ip_address, user_agent, method, path, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sid,
        ipAddress || null,
        userAgent || null,
        method,
        path,
        utmParams.utm_source || null,
        utmParams.utm_medium || null,
        utmParams.utm_campaign || null,
        utmParams.utm_content || null,
        utmParams.utm_term || null
      ]
    );
  } catch (error) {
    console.error('⚠️ Error al registrar usuario nuevo:', error);
    // No lanzamos el error para no afectar el flujo principal
  }
}

// ============================================
// FUNCIONES PARA UTM CONFIGS
// ============================================

/**
 * Obtiene todas las configuraciones UTM
 */
export async function getAllUtmConfigs() {
  try {
    const results = await executeQuery(
      `SELECT * FROM utm_configs ORDER BY created_at DESC`
    );
    return results;
  } catch (error) {
    console.error('❌ Error al obtener configuraciones UTM:', error);
    throw error;
  }
}

/**
 * Obtiene una configuración UTM por su key
 */
export async function getUtmConfigByKey(utmKey) {
  try {
    const results = await executeQuery(
      `SELECT * FROM utm_configs WHERE utm_key = ? AND is_active = TRUE LIMIT 1`,
      [utmKey]
    );
    return results[0] || null;
  } catch (error) {
    console.error('❌ Error al obtener configuración UTM:', error);
    throw error;
  }
}

/**
 * Crea una nueva configuración UTM
 */
export async function createUtmConfig(config) {
  try {
    const result = await executeQuery(
      `INSERT INTO utm_configs
       (utm_key, title, subtitle, button_text, suggested_name, suggested_professor_id,
        special_message, background_color, text_color, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.utmKey,
        config.title,
        config.subtitle || null,
        config.buttonText || null,
        config.suggestedName || null,
        config.suggestedProfessorId || null,
        config.specialMessage || null,
        config.backgroundColor || null,
        config.textColor || null,
        config.imageUrl || null,
        config.isActive !== undefined ? config.isActive : true
      ]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al crear configuración UTM:', error);
    throw error;
  }
}

/**
 * Actualiza una configuración UTM existente
 */
export async function updateUtmConfig(id, config) {
  try {
    const result = await executeQuery(
      `UPDATE utm_configs SET
       title = ?, subtitle = ?, button_text = ?, suggested_name = ?,
       suggested_professor_id = ?, special_message = ?, background_color = ?,
       text_color = ?, image_url = ?, is_active = ?
       WHERE id = ?`,
      [
        config.title,
        config.subtitle || null,
        config.buttonText || null,
        config.suggestedName || null,
        config.suggestedProfessorId || null,
        config.specialMessage || null,
        config.backgroundColor || null,
        config.textColor || null,
        config.imageUrl || null,
        config.isActive !== undefined ? config.isActive : true,
        id
      ]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al actualizar configuración UTM:', error);
    throw error;
  }
}

/**
 * Elimina una configuración UTM
 */
export async function deleteUtmConfig(id) {
  try {
    const result = await executeQuery(
      `DELETE FROM utm_configs WHERE id = ?`,
      [id]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al eliminar configuración UTM:', error);
    throw error;
  }
}

/**
 * Incrementa el contador de vistas para un UTM
 */
export async function incrementUtmViewCount(utmKey) {
  try {
    await executeQuery(
      `UPDATE utm_configs SET view_count = view_count + 1 WHERE utm_key = ?`,
      [utmKey]
    );
  } catch (error) {
    console.error('⚠️ Error al incrementar contador de vistas UTM:', error);
    // No lanzamos el error para no afectar el flujo principal
  }
}

/**
 * Incrementa el contador de clicks para un UTM
 */
export async function incrementUtmClickCount(utmKey) {
  try {
    await executeQuery(
      `UPDATE utm_configs SET click_count = click_count + 1 WHERE utm_key = ?`,
      [utmKey]
    );
  } catch (error) {
    console.error('⚠️ Error al incrementar contador de clicks UTM:', error);
    // No lanzamos el error para no afectar el flujo principal
  }
}

// ============================================
// FUNCIONES PARA UTM TARGETED MESSAGES
// ============================================

/**
 * Obtiene todos los mensajes dirigidos
 */
export async function getAllTargetedMessages() {
  try {
    const results = await executeQuery(
      `SELECT * FROM utm_targeted_messages ORDER BY created_at DESC`
    );
    return results;
  } catch (error) {
    console.error('❌ Error al obtener mensajes dirigidos:', error);
    throw error;
  }
}

/**
 * Obtiene mensajes activos para un usuario basado en su historial de UTM
 */
export async function getActiveTargetedMessagesForUser(sid) {
  try {
    console.log(`🔍 Buscando mensajes para SID: ${sid?.substring(0, 8)}...`);

    // Buscar el utm_source del usuario en todas las tablas posibles
    const userResults = await executeQuery(
      `SELECT DISTINCT utm_source FROM (
        SELECT utm_source FROM usuarios_nuevos WHERE sid = ? AND utm_source IS NOT NULL
        UNION
        SELECT utm_source FROM consultas_log WHERE sid = ? AND utm_source IS NOT NULL
        UNION
        SELECT utm_source FROM profesor_vistas WHERE sid = ? AND utm_source IS NOT NULL
      ) AS all_utm_sources`,
      [sid, sid, sid]
    );

    console.log(`📊 UTM sources encontrados para el usuario:`, userResults);

    if (!userResults || userResults.length === 0) {
      console.log(`⚠️ No se encontró utm_source para SID: ${sid?.substring(0, 8)}...`);
      return [];
    }

    const utmSources = userResults.map(r => r.utm_source);
    const now = new Date();
    console.log(`🕐 Fecha actual para comparación: ${now.toISOString()}`);
    console.log(`🎯 Buscando mensajes para UTM sources: ${utmSources.join(', ')}`);

    // Buscar mensajes activos para esos UTMs que estén en el rango de fechas
    const placeholders = utmSources.map(() => '?').join(',');
    const messages = await executeQuery(
      `SELECT * FROM utm_targeted_messages
       WHERE utm_key IN (${placeholders})
       AND is_active = TRUE
       AND start_date <= ?
       AND end_date >= ?
       ORDER BY created_at DESC`,
      [...utmSources, now, now]
    );

    console.log(`💌 Mensajes encontrados: ${messages?.length || 0}`);
    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        console.log(`  - ID: ${msg.id}, UTM: ${msg.utm_key}, Título: ${msg.title}, Activo: ${msg.is_active}, Rango: ${msg.start_date} - ${msg.end_date}`);
      });
    }

    return messages;
  } catch (error) {
    console.error('❌ Error al obtener mensajes dirigidos para usuario:', error);
    throw error;
  }
}

/**
 * Crea un nuevo mensaje dirigido
 */
export async function createTargetedMessage(message) {
  try {
    const result = await executeQuery(
      `INSERT INTO utm_targeted_messages
       (utm_key, title, subtitle, message, background_color, text_color,
        button_text, button_url, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.utmKey,
        message.title,
        message.subtitle || null,
        message.message,
        message.backgroundColor || null,
        message.textColor || null,
        message.buttonText || null,
        message.buttonUrl || null,
        message.startDate,
        message.endDate,
        message.isActive !== undefined ? message.isActive : true
      ]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al crear mensaje dirigido:', error);
    throw error;
  }
}

/**
 * Actualiza un mensaje dirigido
 */
export async function updateTargetedMessage(id, message) {
  try {
    const result = await executeQuery(
      `UPDATE utm_targeted_messages SET
       title = ?, subtitle = ?, message = ?, background_color = ?,
       text_color = ?, button_text = ?, button_url = ?,
       start_date = ?, end_date = ?, is_active = ?
       WHERE id = ?`,
      [
        message.title,
        message.subtitle || null,
        message.message,
        message.backgroundColor || null,
        message.textColor || null,
        message.buttonText || null,
        message.buttonUrl || null,
        message.startDate,
        message.endDate,
        message.isActive !== undefined ? message.isActive : true,
        id
      ]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al actualizar mensaje dirigido:', error);
    throw error;
  }
}

/**
 * Elimina un mensaje dirigido
 */
export async function deleteTargetedMessage(id) {
  try {
    const result = await executeQuery(
      `DELETE FROM utm_targeted_messages WHERE id = ?`,
      [id]
    );
    return result;
  } catch (error) {
    console.error('❌ Error al eliminar mensaje dirigido:', error);
    throw error;
  }
}

/**
 * Incrementa el contador de visualizaciones de un mensaje dirigido
 */
export async function incrementTargetedMessageShowCount(id) {
  try {
    await executeQuery(
      `UPDATE utm_targeted_messages SET show_count = show_count + 1 WHERE id = ?`,
      [id]
    );
  } catch (error) {
    console.error('⚠️ Error al incrementar contador de visualizaciones:', error);
  }
}

/**
 * Incrementa el contador de clicks de un mensaje dirigido
 */
export async function incrementTargetedMessageClickCount(id) {
  try {
    await executeQuery(
      `UPDATE utm_targeted_messages SET click_count = click_count + 1 WHERE id = ?`,
      [id]
    );
  } catch (error) {
    console.error('⚠️ Error al incrementar contador de clicks:', error);
  }
}

// ============================================
// FUNCIONES PARA ANALYTICS
// ============================================

/**
 * Obtiene estadísticas generales de usuarios por UTM
 */
export async function getUtmAnalytics() {
  try {
    const results = await executeQuery(`
      SELECT
        COALESCE(utm_source, 'Direct') as utm_source,
        COUNT(DISTINCT sid) as unique_users,
        COUNT(*) as total_visits,
        DATE(timestamp) as date
      FROM usuarios_nuevos
      GROUP BY utm_source, DATE(timestamp)
      ORDER BY date DESC, unique_users DESC
    `);
    return results;
  } catch (error) {
    console.error('❌ Error al obtener analytics de UTM:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas resumidas por UTM source
 */
export async function getUtmSummaryStats() {
  try {
    const results = await executeQuery(`
      SELECT
        COALESCE(u.utm_source, 'Direct') as utm_source,
        COUNT(DISTINCT u.sid) as total_users,
        COUNT(DISTINCT c.sid) as users_with_queries,
        COUNT(c.id) as total_queries,
        COUNT(DISTINCT pv.sid) as users_with_views,
        COUNT(pv.id) as total_profesor_views,
        COALESCE(MAX(uc.view_count), 0) as landing_views,
        COALESCE(MAX(uc.click_count), 0) as landing_clicks
      FROM usuarios_nuevos u
      LEFT JOIN consultas_log c ON u.sid = c.sid
      LEFT JOIN profesor_vistas pv ON u.sid = pv.sid
      LEFT JOIN utm_configs uc ON u.utm_source = uc.utm_key
      GROUP BY COALESCE(u.utm_source, 'Direct')
      ORDER BY total_users DESC
    `);
    return results;
  } catch (error) {
    console.error('❌ Error al obtener resumen de stats de UTM:', error);
    throw error;
  }
}

/**
 * Obtiene usuarios (SIDs/cookies) por UTM source con detalles
 */
export async function getUsersByUtmSource(utmSource) {
  try {
    const results = await executeQuery(`
      SELECT
        u.sid,
        u.timestamp as first_seen,
        u.ip_address,
        u.user_agent,
        u.utm_source,
        u.utm_medium,
        u.utm_campaign,
        COUNT(DISTINCT c.id) as total_queries,
        COUNT(DISTINCT pv.id) as total_profesor_views,
        MAX(c.timestamp) as last_query,
        MAX(pv.timestamp) as last_view
      FROM usuarios_nuevos u
      LEFT JOIN consultas_log c ON u.sid = c.sid
      LEFT JOIN profesor_vistas pv ON u.sid = pv.sid
      WHERE u.utm_source = ? OR (u.utm_source IS NULL AND ? = 'Direct')
      GROUP BY u.sid, u.timestamp, u.ip_address, u.user_agent, u.utm_source, u.utm_medium, u.utm_campaign
      ORDER BY u.timestamp DESC
      LIMIT 100
    `, [utmSource, utmSource]);
    return results;
  } catch (error) {
    console.error('❌ Error al obtener usuarios por UTM:', error);
    throw error;
  }
}

/**
 * Obtiene conteo de usuarios únicos por UTM
 */
export async function getUtmUserCounts() {
  try {
    const results = await executeQuery(`
      SELECT
        COALESCE(utm_source, 'Direct') as utm_source,
        COUNT(DISTINCT sid) as user_count,
        MIN(timestamp) as first_user,
        MAX(timestamp) as last_user
      FROM usuarios_nuevos
      GROUP BY utm_source
      ORDER BY user_count DESC
    `);
    return results;
  } catch (error) {
    console.error('❌ Error al obtener conteo de usuarios por UTM:', error);
    throw error;
  }
}
