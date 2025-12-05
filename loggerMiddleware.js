import { randomUUID } from "crypto";
import { logUsuarioNuevo, logConsulta, logProfesorVista, getUtmSourceBySid } from "./database.js";

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

  // Extraer parámetros UTM de la URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const utmParams = {
    utm_source: url.searchParams.get('src') || url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
    utm_content: url.searchParams.get('utm_content'),
    utm_term: url.searchParams.get('utm_term')
  };

  // Debug: Log de parámetros UTM extraídos
  if (utmParams.utm_source) {
    console.log('🏷️ UTM params detectados:', {
      url: req.url,
      utmParams: utmParams
    });
  }

  req.utmParams = utmParams;
  
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
    const logDataWithUtm = { ...logData, utm: utmParams.utm_source ? utmParams : null };
    console.log(`🆕 Usuario nuevo -> ${JSON.stringify(logDataWithUtm)}`);

    // Guardar en base de datos solo si es usuario nuevo
    logUsuarioNuevo(sid, ip, ua, req.method, logData.path, utmParams).catch(err => {
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
  res.on('finish', async () => {
    const duracionMs = Date.now() - startTime;

    // Si no hay UTM en la request actual, intentar obtenerlo del historial del usuario
    let utmSource = req.utmParams?.utm_source;
    if (!utmSource && !isNewUser) {
      utmSource = await getUtmSourceBySid(sid);
      if (utmSource) {
        console.log(`🔍 UTM recuperado del historial: ${utmSource} para SID: ${sid.substring(0, 8)}...`);
      }
    }

    // Logging específico por endpoint
    if (req.originalUrl.startsWith('/api/consulta') && req.method === 'POST' && req.responseData) {
      const { entidadFederativa } = req.body || {};
      const nombreProfesor = req.body?.contenido || null;
      const totalRegistros = req.totalRegistros || 0;
      const registrosFiltrados = req.responseData?.datosSolr?.length || 0;

      if (utmSource) {
        console.log(`📝 Guardando consulta con UTM: ${utmSource}`);
      }

      logConsulta(
        sid,
        nombreProfesor,
        entidadFederativa,
        totalRegistros,
        registrosFiltrados,
        duracionMs,
        ip,
        ua,
        utmSource
      ).catch(err => {
        console.error('⚠️ Error al guardar consulta en BD:', err);
      });
    } else if (req.originalUrl.startsWith('/api/profesor-vista') && req.method === 'POST') {
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

      if (utmSource) {
        console.log(`📝 Guardando vista de profesor con UTM: ${utmSource}`);
      }

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
        ua,
        utmSource
      ).catch(err => {
        console.error('⚠️ Error al guardar vista de profesor en BD:', err);
      });
    }
  });
  
  // Continuar al siguiente middleware/handler
  next();
}

