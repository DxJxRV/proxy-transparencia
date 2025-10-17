import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { handleConsulta, handleProfesorVista } from "./consultaHandler.js";
import { initDatabase, closeDatabase } from "./database.js";
import { loggerMiddleware } from "./loggerMiddleware.js";
import { 
  getNombresMasBuscados, 
  getProfesoresMasClickeados, 
  getProfesoresTopSueldoAcumulado,
  getProfesoresBottomSueldoAcumulado,
  getEstadisticasGenerales
} from "./analyticsHandler.js";

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
  methods: ["GET", "POST", "OPTIONS"],
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
