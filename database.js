import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
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

    return pool;
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
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
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_ip (ip_address),
        INDEX idx_method (method)
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
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_entidad (entidad_federativa),
        INDEX idx_nombre (nombre_profesor),
        INDEX idx_ip (ip_address)
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
        INDEX idx_timestamp (timestamp),
        INDEX idx_sid (sid),
        INDEX idx_profesor_id (profesor_id),
        INDEX idx_nombre (nombre_profesor),
        INDEX idx_entidad (entidad_federativa),
        INDEX idx_ip (ip_address)
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
export async function logConsulta(sid, nombreProfesor, entidadFederativa, totalRegistros, registrosFiltrados, duracionMs, ipAddress, userAgent) {
  try {
    await executeQuery(
      `INSERT INTO consultas_log 
       (sid, nombre_profesor, entidad_federativa, total_registros, registros_filtrados, duracion_ms, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid || null, nombreProfesor || null, entidadFederativa || null, totalRegistros, registrosFiltrados, duracionMs, ipAddress || null, userAgent || null]
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
export async function logProfesorVista(sid, profesorId, nombreProfesor, sujetoObligado, entidadFederativa, sueldoMaximo, sueldoAcumulado, ultimoSueldo, ipAddress, userAgent) {
  try {
    await executeQuery(
      `INSERT INTO profesor_vistas 
       (sid, profesor_id, nombre_profesor, sujeto_obligado, entidad_federativa, sueldo_maximo, sueldo_acumulado, ultimo_sueldo, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        userAgent || null
      ]
    );
  } catch (error) {
    console.error('⚠️ Error al registrar vista de profesor:', error);
    // No lanzamos el error para no afectar la respuesta principal
  }
}

/**
 * Registra un usuario nuevo desde el logger middleware
 */
export async function logUsuarioNuevo(sid, ipAddress, userAgent, method, path) {
  try {
    await executeQuery(
      `INSERT INTO usuarios_nuevos 
       (sid, ip_address, user_agent, method, path) 
       VALUES (?, ?, ?, ?, ?)`,
      [sid, ipAddress || null, userAgent || null, method, path]
    );
  } catch (error) {
    console.error('⚠️ Error al registrar usuario nuevo:', error);
    // No lanzamos el error para no afectar el flujo principal
  }
}
