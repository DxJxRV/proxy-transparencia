import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { handleConsulta, handleProfesorVista, buscarPorApellido, buscarPorInstitucion } from "./consultaHandler.js";
import { initDatabase, closeDatabase } from "./database.js";
import { loggerMiddleware } from "./loggerMiddleware.js";
import {
  getNombresMasBuscados,
  getProfesoresMasClickeados,
  getProfesoresTopSueldoAcumulado,
  getProfesoresBottomSueldoAcumulado,
  getEstadisticasGenerales
} from "./analyticsHandler.js";
import {
  getAllUtmConfigs,
  getUtmConfigByKey,
  createUtmConfig,
  updateUtmConfig,
  deleteUtmConfig,
  incrementUtmViewCount,
  incrementUtmClickCount,
  getAllTargetedMessages,
  getActiveTargetedMessagesForUser,
  createTargetedMessage,
  updateTargetedMessage,
  deleteTargetedMessage,
  incrementTargetedMessageShowCount,
  incrementTargetedMessageClickCount,
  getUtmAnalytics,
  getUtmSummaryStats,
  getUsersByUtmSource,
  getUtmUserCounts
} from "./database.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET_URL = process.env.TARGET_URL;


app.set("trust proxy", true);


// Middleware de logging con seguimiento de sesión
app.use(loggerMiddleware);


// CORS: limita al origen de tu frontend
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"]
}));

app.use(express.json());





app.get("/api/ping", (req, res) => {
  res.set("Cache-Control", "no-store"); // evita 304
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});


// Proxy endpoint
app.post("/api/consulta", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📡 Nueva petición recibida`);
  
  try {
    const result = await handleConsulta(req, TARGET_URL);
    
    if (result.contentType === "application/json") {
      res.status(result.status).json(result.data);
    } else {
      res.status(result.status).type(result.contentType).send(result.data);
    }
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en proxy:`, err);
    res.status(500).json({ error: "Proxy error", detail: String(err) });
  }
});

// Endpoint para registrar vista de card de profesor
app.post("/api/profesor-vista", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 👁️ Registro de vista de profesor`);
  
  try {
    const result = await handleProfesorVista(req);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al registrar vista:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al registrar vista", 
      detail: String(err) 
    });
  }
});

// Endpoint para buscar personas con el mismo apellido
app.post("/api/same-lastname", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 👨‍👩‍👧‍👦 Búsqueda por apellido`);

  try {
    const { apellidoPaterno, apellidoMaterno, excludeProfessorId, numeroPagina = 0, fetchAll = false, maxRecords = 5000, searchText = '' } = req.body;

    if (!apellidoPaterno) {
      return res.status(400).json({
        success: false,
        error: "El apellido paterno es requerido"
      });
    }

    const result = await buscarPorApellido(apellidoPaterno, apellidoMaterno, TARGET_URL, excludeProfessorId, numeroPagina, fetchAll, maxRecords, searchText);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en búsqueda por apellido:`, err);
    res.status(500).json({
      success: false,
      error: "Error al buscar por apellido",
      detail: String(err)
    });
  }
});

// Endpoint para buscar personas de la misma institución
app.post("/api/same-institution", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🏛️ Búsqueda por institución`);

  try {
    const { identificadorGrupo, idEntidadFederativa, sujetoObligado, excludeProfessorId, numeroPagina = 0, fetchAll = false, maxRecords = 5000, searchText = '' } = req.body;

    if (!identificadorGrupo || !sujetoObligado) {
      return res.status(400).json({
        success: false,
        error: "El identificadorGrupo y sujetoObligado son requeridos"
      });
    }

    const result = await buscarPorInstitucion(identificadorGrupo, idEntidadFederativa, sujetoObligado, TARGET_URL, excludeProfessorId, numeroPagina, fetchAll, maxRecords, searchText);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en búsqueda por institución:`, err);
    res.status(500).json({
      success: false,
      error: "Error al buscar por institución",
      detail: String(err)
    });
  }
});

// ==================== ENDPOINTS DE ANALYTICS ====================

// Endpoint: Nombres más buscados
app.get("/api/analytics/nombres-mas-buscados", async (req, res) => {
  const timestamp = new Date().toISOString();
  const limit = parseInt(req.query.limit) || 10;
  
  console.log(`[${timestamp}] 📊 Solicitando nombres más buscados (limit: ${limit})`);
  
  try {
    const result = await getNombresMasBuscados(limit);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en analytics:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al obtener estadísticas", 
      detail: String(err) 
    });
  }
});

// Endpoint: Profesores más clickeados
app.get("/api/analytics/profesores-mas-clickeados", async (req, res) => {
  const timestamp = new Date().toISOString();
  const limit = parseInt(req.query.limit) || 10;
  
  console.log(`[${timestamp}] 📊 Solicitando profesores más clickeados (limit: ${limit})`);
  
  try {
    const result = await getProfesoresMasClickeados(limit);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en analytics:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al obtener estadísticas", 
      detail: String(err) 
    });
  }
});

// Endpoint: Top profesores por sueldo acumulado (mayores)
app.get("/api/analytics/top-sueldos", async (req, res) => {
  const timestamp = new Date().toISOString();
  const limit = parseInt(req.query.limit) || 10;
  
  console.log(`[${timestamp}] 📊 Solicitando top sueldos acumulados (limit: ${limit})`);
  
  try {
    const result = await getProfesoresTopSueldoAcumulado(limit);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en analytics:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al obtener estadísticas", 
      detail: String(err) 
    });
  }
});

// Endpoint: Bottom profesores por sueldo acumulado (menores, excluyendo 0)
app.get("/api/analytics/bottom-sueldos", async (req, res) => {
  const timestamp = new Date().toISOString();
  const limit = parseInt(req.query.limit) || 10;
  
  console.log(`[${timestamp}] 📊 Solicitando bottom sueldos acumulados (limit: ${limit})`);
  
  try {
    const result = await getProfesoresBottomSueldoAcumulado(limit);
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en analytics:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al obtener estadísticas", 
      detail: String(err) 
    });
  }
});

// Endpoint: Estadísticas generales del sistema
app.get("/api/analytics/estadisticas-generales", async (req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] 📊 Solicitando estadísticas generales`);
  
  try {
    const result = await getEstadisticasGenerales();
    res.status(200).json(result);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR en analytics:`, err);
    res.status(500).json({ 
      success: false, 
      error: "Error al obtener estadísticas", 
      detail: String(err) 
    });
  }
});

// ==================== FIN ENDPOINTS DE ANALYTICS ====================

// ==================== ENDPOINTS DE UTM CONFIGS ====================

// Endpoint: Obtener todas las configuraciones UTM
app.get("/api/utm-configs", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 🎯 PETICIÓN RECIBIDA: /api/utm-configs`);
  console.log(`Método: ${req.method}`);
  console.log(`IP: ${req.ip}`);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getAllUtmConfigs()...`);
    const configs = await getAllUtmConfigs();
    console.log(`[${timestamp}] ✅ Configuraciones obtenidas exitosamente. Total: ${configs.length}`);

    res.status(200).json({
      success: true,
      data: configs
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener configuraciones UTM:`, err);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener configuraciones UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Obtener configuración UTM por key
app.get("/api/utm-configs/:key", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { key } = req.params;
  console.log(`[${timestamp}] 🎯 Solicitando configuración UTM para key: ${key}`);

  try {
    const config = await getUtmConfigByKey(key);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: "Configuración UTM no encontrada"
      });
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener configuración UTM:`, err);
    res.status(500).json({
      success: false,
      error: "Error al obtener configuración UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Crear nueva configuración UTM
app.post("/api/utm-configs", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🎯 Creando nueva configuración UTM`);

  try {
    const {
      utmKey,
      title,
      subtitle,
      buttonText,
      suggestedName,
      suggestedProfessorId,
      specialMessage,
      backgroundColor,
      textColor,
      buttonColor,
      imageUrl,
      isActive
    } = req.body;

    // Validar campos requeridos
    if (!utmKey || !title) {
      return res.status(400).json({
        success: false,
        error: "Los campos 'utmKey' y 'title' son requeridos"
      });
    }

    const result = await createUtmConfig({
      utmKey,
      title,
      subtitle,
      buttonText,
      suggestedName,
      suggestedProfessorId,
      specialMessage,
      backgroundColor,
      textColor,
      buttonColor,
      imageUrl,
      isActive
    });

    res.status(201).json({
      success: true,
      message: "Configuración UTM creada exitosamente",
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al crear configuración UTM:`, err);

    // Manejar error de clave duplicada
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: "Ya existe una configuración con ese utm_key"
      });
    }

    res.status(500).json({
      success: false,
      error: "Error al crear configuración UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Actualizar configuración UTM existente
app.put("/api/utm-configs/:id", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 🎯 Actualizando configuración UTM ID: ${id}`);

  try {
    const {
      title,
      subtitle,
      buttonText,
      suggestedName,
      suggestedProfessorId,
      specialMessage,
      backgroundColor,
      textColor,
      buttonColor,
      imageUrl,
      isActive
    } = req.body;

    // Validar campos requeridos
    if (!title) {
      return res.status(400).json({
        success: false,
        error: "El campo 'title' es requerido"
      });
    }

    const result = await updateUtmConfig(id, {
      title,
      subtitle,
      buttonText,
      suggestedName,
      suggestedProfessorId,
      specialMessage,
      backgroundColor,
      textColor,
      buttonColor,
      imageUrl,
      isActive
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Configuración UTM no encontrada"
      });
    }

    res.status(200).json({
      success: true,
      message: "Configuración UTM actualizada exitosamente"
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al actualizar configuración UTM:`, err);
    res.status(500).json({
      success: false,
      error: "Error al actualizar configuración UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Eliminar configuración UTM
app.delete("/api/utm-configs/:id", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 🎯 Eliminando configuración UTM ID: ${id}`);

  try {
    const result = await deleteUtmConfig(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Configuración UTM no encontrada"
      });
    }

    res.status(200).json({
      success: true,
      message: "Configuración UTM eliminada exitosamente"
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al eliminar configuración UTM:`, err);
    res.status(500).json({
      success: false,
      error: "Error al eliminar configuración UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Incrementar contador de vistas para un UTM
app.post("/api/utm-configs/:key/view", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { key } = req.params;
  console.log(`[${timestamp}] 👁️ Incrementando vistas para UTM: ${key}`);

  try {
    await incrementUtmViewCount(key);
    res.status(200).json({
      success: true,
      message: "Vista registrada"
    });
  } catch (err) {
    console.error(`[${timestamp}] ⚠️ ERROR al incrementar vistas UTM:`, err);
    // No lanzamos error 500 para no afectar el flujo del usuario
    res.status(200).json({
      success: false,
      message: "Error al registrar vista (no crítico)"
    });
  }
});

// Endpoint: Incrementar contador de clicks para un UTM
app.post("/api/utm-configs/:key/click", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { key } = req.params;
  console.log(`[${timestamp}] 🖱️ Incrementando clicks para UTM: ${key}`);

  try {
    await incrementUtmClickCount(key);
    res.status(200).json({
      success: true,
      message: "Click registrado"
    });
  } catch (err) {
    console.error(`[${timestamp}] ⚠️ ERROR al incrementar clicks UTM:`, err);
    // No lanzamos error 500 para no afectar el flujo del usuario
    res.status(200).json({
      success: false,
      message: "Error al registrar click (no crítico)"
    });
  }
});

// ==================== FIN ENDPOINTS DE UTM CONFIGS ====================

// ==================== ENDPOINTS DE TARGETED MESSAGES ====================

// Endpoint: Obtener todos los mensajes dirigidos
app.get("/api/targeted-messages", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 💌 PETICIÓN RECIBIDA: /api/targeted-messages`);
  console.log(`Método: ${req.method}`);
  console.log(`IP: ${req.ip}`);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getAllTargetedMessages()...`);
    const messages = await getAllTargetedMessages();
    console.log(`[${timestamp}] ✅ Mensajes obtenidos exitosamente. Total: ${messages.length}`);

    res.status(200).json({
      success: true,
      data: messages
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener mensajes dirigidos:`, err);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener mensajes dirigidos",
      detail: String(err)
    });
  }
});

// Endpoint: Obtener mensajes activos para el usuario actual (basado en SID)
app.get("/api/targeted-messages/active", async (req, res) => {
  const timestamp = new Date().toISOString();
  const sid = req.sid; // Viene del loggerMiddleware
  console.log(`[${timestamp}] 💌 Solicitando mensajes activos para SID: ${sid}`);

  try {
    const messages = await getActiveTargetedMessagesForUser(sid);
    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener mensajes activos:`, err);
    res.status(500).json({
      success: false,
      error: "Error al obtener mensajes activos",
      detail: String(err)
    });
  }
});

// Endpoint: Crear nuevo mensaje dirigido
app.post("/api/targeted-messages", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 💌 Creando nuevo mensaje dirigido`);

  try {
    const {
      utmKey,
      title,
      subtitle,
      message,
      backgroundColor,
      textColor,
      buttonText,
      buttonUrl,
      startDate,
      endDate,
      isActive
    } = req.body;

    // Validar campos requeridos
    if (!utmKey || !title || !message || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Los campos 'utmKey', 'title', 'message', 'startDate' y 'endDate' son requeridos"
      });
    }

    const result = await createTargetedMessage({
      utmKey,
      title,
      subtitle,
      message,
      backgroundColor,
      textColor,
      buttonText,
      buttonUrl,
      startDate,
      endDate,
      isActive
    });

    res.status(201).json({
      success: true,
      message: "Mensaje dirigido creado exitosamente",
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al crear mensaje dirigido:`, err);
    res.status(500).json({
      success: false,
      error: "Error al crear mensaje dirigido",
      detail: String(err)
    });
  }
});

// Endpoint: Actualizar mensaje dirigido
app.put("/api/targeted-messages/:id", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 💌 Actualizando mensaje dirigido ID: ${id}`);

  try {
    const {
      title,
      subtitle,
      message,
      backgroundColor,
      textColor,
      buttonText,
      buttonUrl,
      startDate,
      endDate,
      isActive
    } = req.body;

    // Validar campos requeridos
    if (!title || !message || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Los campos 'title', 'message', 'startDate' y 'endDate' son requeridos"
      });
    }

    const result = await updateTargetedMessage(id, {
      title,
      subtitle,
      message,
      backgroundColor,
      textColor,
      buttonText,
      buttonUrl,
      startDate,
      endDate,
      isActive
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Mensaje dirigido no encontrado"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mensaje dirigido actualizado exitosamente"
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al actualizar mensaje dirigido:`, err);
    res.status(500).json({
      success: false,
      error: "Error al actualizar mensaje dirigido",
      detail: String(err)
    });
  }
});

// Endpoint: Eliminar mensaje dirigido
app.delete("/api/targeted-messages/:id", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 💌 Eliminando mensaje dirigido ID: ${id}`);

  try {
    const result = await deleteTargetedMessage(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Mensaje dirigido no encontrado"
      });
    }

    res.status(200).json({
      success: true,
      message: "Mensaje dirigido eliminado exitosamente"
    });
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al eliminar mensaje dirigido:`, err);
    res.status(500).json({
      success: false,
      error: "Error al eliminar mensaje dirigido",
      detail: String(err)
    });
  }
});

// Endpoint: Incrementar contador de visualizaciones de mensaje dirigido
app.post("/api/targeted-messages/:id/show", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 👁️ Incrementando visualizaciones para mensaje ID: ${id}`);

  try {
    await incrementTargetedMessageShowCount(id);
    res.status(200).json({
      success: true,
      message: "Visualización registrada"
    });
  } catch (err) {
    console.error(`[${timestamp}] ⚠️ ERROR al incrementar visualizaciones:`, err);
    res.status(200).json({
      success: false,
      message: "Error al registrar visualización (no crítico)"
    });
  }
});

// Endpoint: Incrementar contador de clicks de mensaje dirigido
app.post("/api/targeted-messages/:id/click", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  console.log(`[${timestamp}] 🖱️ Incrementando clicks para mensaje ID: ${id}`);

  try {
    await incrementTargetedMessageClickCount(id);
    res.status(200).json({
      success: true,
      message: "Click registrado"
    });
  } catch (err) {
    console.error(`[${timestamp}] ⚠️ ERROR al incrementar clicks:`, err);
    res.status(200).json({
      success: false,
      message: "Error al registrar click (no crítico)"
    });
  }
});

// ==================== FIN ENDPOINTS DE TARGETED MESSAGES ====================

// ==================== ENDPOINTS DE UTM ANALYTICS ====================

// Endpoint: Obtener analytics detallados de UTM por fecha
app.get("/api/utm-analytics", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 📊 PETICIÓN RECIBIDA: /api/utm-analytics`);
  console.log(`Método: ${req.method}`);
  console.log(`Headers:`, req.headers);
  console.log(`IP: ${req.ip}`);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getUtmAnalytics()...`);
    const analytics = await getUtmAnalytics();
    console.log(`[${timestamp}] ✅ Analytics obtenidos exitosamente. Registros: ${analytics.length}`);

    res.status(200).json({
      success: true,
      data: analytics
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener analytics de UTM:`, err);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener analytics de UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Obtener resumen de estadísticas por UTM source
app.get("/api/utm-analytics/summary", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 📊 PETICIÓN RECIBIDA: /api/utm-analytics/summary`);
  console.log(`Método: ${req.method}`);
  console.log(`Headers:`, req.headers);
  console.log(`IP: ${req.ip}`);
  console.log(`Query params:`, req.query);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getUtmSummaryStats()...`);
    const summary = await getUtmSummaryStats();
    console.log(`[${timestamp}] ✅ Resumen obtenido exitosamente. Registros: ${summary.length}`);
    console.log(`[${timestamp}] 📊 Datos:`, JSON.stringify(summary, null, 2));

    res.status(200).json({
      success: true,
      data: summary
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener resumen de analytics:`, err);
    console.error(`Error name: ${err.name}`);
    console.error(`Error message: ${err.message}`);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener resumen de analytics",
      detail: String(err)
    });
  }
});

// Endpoint: Obtener usuarios por UTM source
app.get("/api/utm-analytics/users/:utmSource", async (req, res) => {
  const timestamp = new Date().toISOString();
  const { utmSource } = req.params;
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 📊 PETICIÓN RECIBIDA: /api/utm-analytics/users/${utmSource}`);
  console.log(`Método: ${req.method}`);
  console.log(`IP: ${req.ip}`);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getUsersByUtmSource("${utmSource}")...`);
    const users = await getUsersByUtmSource(utmSource);
    console.log(`[${timestamp}] ✅ Usuarios obtenidos exitosamente. Total: ${users.length}`);

    res.status(200).json({
      success: true,
      data: users
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener usuarios por UTM:`, err);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener usuarios por UTM",
      detail: String(err)
    });
  }
});

// Endpoint: Obtener conteo de usuarios por UTM
app.get("/api/utm-analytics/user-counts", async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[${timestamp}] 📊 PETICIÓN RECIBIDA: /api/utm-analytics/user-counts`);
  console.log(`Método: ${req.method}`);
  console.log(`IP: ${req.ip}`);
  console.log(`========================================\n`);

  try {
    console.log(`[${timestamp}] 🔄 Llamando a getUtmUserCounts()...`);
    const counts = await getUtmUserCounts();
    console.log(`[${timestamp}] ✅ Conteo obtenido exitosamente. UTM sources: ${counts.length}`);
    console.log(`[${timestamp}] 📊 Datos:`, JSON.stringify(counts, null, 2));

    res.status(200).json({
      success: true,
      data: counts
    });
    console.log(`[${timestamp}] 📤 Respuesta enviada exitosamente\n`);
  } catch (err) {
    console.error(`[${timestamp}] 💥 ERROR al obtener conteo de usuarios:`, err);
    console.error(`Stack trace:`, err.stack);
    res.status(500).json({
      success: false,
      error: "Error al obtener conteo de usuarios",
      detail: String(err)
    });
  }
});

// ==================== FIN ENDPOINTS DE UTM ANALYTICS ====================

// Inicializar la base de datos y arrancar el servidor
async function startServer() {
  try {
    // Inicializar base de datos
    await initDatabase();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`✅ Proxy escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('💥 Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Señal de interrupción recibida, cerrando servidor...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Señal de terminación recibida, cerrando servidor...');
  await closeDatabase();
  process.exit(0);
});

// Iniciar el servidor
startServer();
