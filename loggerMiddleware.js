import { randomUUID } from "crypto";
import { logUsuarioNuevo, logConsulta, logProfesorVista } from "./database.js";

/**
 * Middleware para registrar peticiones entrantes con seguimiento de sesión
 * - Genera o reutiliza un session ID (sid) vía cookie
 * - Registra información de la petición en consola
 * - Identifica usuarios nuevos vs recurrentes
 * - Registra automáticamente en la base de datos según el endpoint
 */
export function loggerMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  
  // Extraer sid de las cookies
  const cookies = req.headers.cookie?.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {}) || {};
  
  let sid = cookies.sid;
  let isNewUser = false;
  
  // Si no tiene sid, generar uno nuevo
  if (!sid) {
    sid = randomUUID();
    isNewUser = true;
    
    // Setear cookie con el nuevo sid
    res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`);
  }
  
  // Asignar datos al request para uso posterior
  req.sid = sid;
  req.startTime = startTime;
  req.timestamp = timestamp;
  
  // Obtener IP del cliente (prioridad: x-forwarded-for > x-real-ip > remoteAddress > ip)
  const ip = 
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";
  
  req.clientIp = ip;
  
  // Obtener User-Agent
  const ua = req.headers["user-agent"] || "unknown";
  req.userAgent = ua;
  
  // Construir objeto de log
  const logData = {
    sid,
    ip,
    ua,
    method: req.method,
    path: req.originalUrl || req.url,
    ts: timestamp
  };
  
  // Imprimir en consola
  if (isNewUser) {
    console.log(`🆕 Usuario nuevo -> ${JSON.stringify(logData)}`);
    
    // Guardar en base de datos solo si es usuario nuevo
    logUsuarioNuevo(sid, ip, ua, req.method, logData.path).catch(err => {
      console.error('⚠️ Error al guardar usuario nuevo en BD:', err);
    });
  } else {
    console.log(`🔁 Usuario recurrente -> ${JSON.stringify(logData)}`);
  }
  
  // Interceptar el método json() de la respuesta para capturar los datos
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Guardar los datos de respuesta en el request para logging posterior
    req.responseData = data;
    return originalJson(data);
  };
  
  // Hook para ejecutar logging después de enviar la respuesta
  res.on('finish', () => {
    const duracionMs = Date.now() - startTime;
    
    // Logging específico por endpoint
    if (req.originalUrl === '/api/consulta' && req.method === 'POST' && req.responseData) {
      const { entidadFederativa } = req.body || {};
      const nombreProfesor = req.body?.contenido || null;
      const totalRegistros = req.totalRegistros || 0;
      const registrosFiltrados = req.responseData?.datosSolr?.length || 0;
      
      logConsulta(
        sid,
        nombreProfesor,
        entidadFederativa,
        totalRegistros,
        registrosFiltrados,
        duracionMs,
        ip,
        ua
      ).catch(err => {
        console.error('⚠️ Error al guardar consulta en BD:', err);
      });
    } else if (req.originalUrl === '/api/profesor-vista' && req.method === 'POST') {
      const {
        professorId,
        nombreProfesor,
        sujetoObligado,
        entidadFederativa,
        sueldoMaximo,
        sueldoAcumulado,
        ultimoSueldo
      } = req.body || {};
      
      // Parsear sueldos si vienen como strings
      const parsearMonto = (monto) => {
        try {
          if (typeof monto === 'string') {
            return parseFloat(monto.replace(/[$,]/g, ''));
          }
          return monto;
        } catch {
          return null;
        }
      };
      
      logProfesorVista(
        sid,
        professorId,
        nombreProfesor,
        sujetoObligado,
        entidadFederativa,
        parsearMonto(sueldoMaximo),
        parsearMonto(sueldoAcumulado),
        parsearMonto(ultimoSueldo),
        ip,
        ua
      ).catch(err => {
        console.error('⚠️ Error al guardar vista de profesor en BD:', err);
      });
    }
  });
  
  // Continuar al siguiente middleware/handler
  next();
}

