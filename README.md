# Mini Proxy Transparencia

Proxy para la plataforma de transparencia con procesamiento de datos y almacenamiento en MySQL.

## 🚀 Configuración

### Requisitos previos

- Node.js 18+
- MySQL 8.0+

### Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:
```env
# Servidor
PORT=3001
TARGET_URL=https://api.plataformadetransparencia.org.mx/endpoint
ALLOWED_ORIGIN=*

# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=transparencia_db
```

### Iniciar el servidor

**Modo desarrollo:**
```bash
npm run dev
```

**Modo producción:**
```bash
npm start
```

## 📊 Base de datos

La aplicación se conecta automáticamente a MySQL al iniciar y:

1. ✅ Crea la base de datos si no existe (`transparencia_db` por defecto)
2. ✅ Crea las tablas necesarias automáticamente
3. ✅ Mantiene un pool de conexiones optimizado
4. ✅ Registra logs de consultas y seguimiento de usuarios

### 🆔 Seguimiento de sesión

El servidor implementa un sistema de seguimiento de sesión mediante cookies:

- **Cookie `sid`**: Se asigna automáticamente a cada usuario en su primera visita
- **Identificación de usuarios**:
  - 🆕 **Usuario nuevo**: Primera vez que accede, se genera un UUID único
  - 🔁 **Usuario recurrente**: Ya tiene un `sid` de visitas anteriores
- **Logs automáticos**: Registra en consola y base de datos la actividad de usuarios nuevos
- **Configuración de cookie**: `HttpOnly`, `SameSite=Lax`, `Path=/`


### Tablas creadas

- **`usuarios_nuevos`**: Registro de usuarios nuevos detectados por el middleware
  - `id`: ID autoincremental
  - `timestamp`: Fecha y hora del primer acceso
  - `sid`: Session ID único (UUID)
  - `ip_address`: Dirección IP del usuario
  - `user_agent`: User Agent del navegador
  - `method`: Método HTTP (GET, POST, etc.)
  - `path`: Ruta accedida

- **`consultas_log`**: Registro de todas las consultas realizadas
  - `id`: ID autoincremental
  - `timestamp`: Fecha y hora de la consulta
  - `sid`: Session ID del usuario (UUID)
  - `nombre_profesor`: Nombre del profesor consultado (si aplica)
  - `entidad_federativa`: Entidad federativa filtrada (si aplica)
  - `total_registros`: Total de registros recibidos
  - `registros_filtrados`: Registros después del filtrado
  - `duracion_ms`: Duración de la consulta en milisegundos
  - `ip_address`: Dirección IP del cliente (IPv4 o IPv6)
  - `user_agent`: User Agent del navegador/cliente

- **`profesor_vistas`**: Registro de vistas de cards de profesores
  - `id`: ID autoincremental de la tabla
  - `timestamp`: Fecha y hora de la vista
  - `sid`: Session ID del usuario (UUID)
  - `profesor_id`: Identificador del profesor (puede repetirse)
  - `nombre_profesor`: Nombre completo del profesor
  - `sujeto_obligado`: Institución donde trabaja/trabajó
  - `entidad_federativa`: Estado/entidad federativa
  - `sueldo_maximo`: Sueldo máximo registrado (DECIMAL)
  - `sueldo_acumulado`: Suma total de sueldos (DECIMAL)
  - `ultimo_sueldo`: Último sueldo registrado (DECIMAL)
  - `ip_address`: IP del usuario que vio la card
  - `user_agent`: User Agent del navegador

## 🛠️ Estructura del proyecto

```
mini-proxy-transparencia/
├── server.js              # Configuración de Express y servidor
├── consultaHandler.js     # Lógica de procesamiento de consultas (sin logging DB)
├── database.js           # Configuración y funciones de base de datos
├── loggerMiddleware.js   # Middleware centralizado (logging, sesión, DB)
├── package.json
├── .env                  # Variables de entorno (no incluido en git)
├── .env.example         # Ejemplo de variables de entorno
└── README.md
```

### 📝 Arquitectura de logging

El sistema utiliza un **middleware centralizado** (`loggerMiddleware.js`) que:

1. **Gestiona sesiones**: Genera/valida cookies `sid` para tracking de usuarios
2. **Captura datos del request**: IP, User-Agent, timestamp, método, ruta
3. **Intercepta respuestas**: Hook en `res.json()` y evento `finish`
4. **Logging automático en BD**: 
   - `/api/consulta` → Guarda en `consultas_log`
   - `/api/profesor-vista` → Guarda en `profesor_vistas`
   - Usuarios nuevos → Guarda en `usuarios_nuevos`
5. **Sin duplicación de código**: Los handlers (`consultaHandler.js`) ya no necesitan llamar funciones de logging manualmente

**Ventajas:**
- ✅ DRY (Don't Repeat Yourself): Código centralizado
- ✅ Separation of Concerns: Los handlers solo procesan datos
- ✅ Mantenibilidad: Un solo lugar para modificar logging
- ✅ Automático: Todo request/response se loguea sin código extra

## 📡 API Endpoints

### POST `/api/consulta`

Realiza una consulta al servidor de transparencia y procesa los datos.

**Request body:**
```json
{
  "nombreProfesor": "Juan Pérez",  // Opcional - se registra en logs
  "entidadFederativa": "Morelos",  // Opcional - filtro de búsqueda
  "otroParametro": "valor"
}
```

**Response:**
```json
{
  "datosSolr": [
    {
      "nombre": "JUAN PÉREZ",
      "profesorId": "wUDin6yPOLLEDLQ8yWDpXg==",
      "sujetoObligado": "Institución XYZ",
      "entidadFederativa": "Morelos",
      "periodoMontos": [
        {
          "periodo": "01/01/2024 - 31/01/2024",
          "monto": "$10,000.00"
        }
      ],
      "sueldoActual": "$10,000.00",
      "sueldoMax": {
        "monto": "$15,000.00",
        "periodo": "01/06/2024 - 30/06/2024"
      },
      "sueldoAcumulado": 125000.50
    }
  ],
  "sujetosObligados": [...],
  "entidadesFederativas": ["Morelos", "CDMX", ...]
}
```

### POST `/api/profesor-vista`

Registra una vista de la card de un profesor. Útil para analytics y seguimiento.

**Request body:**
```json
{
  "profesorId": "profesor-123",
  "nombreProfesor": "Juan Pérez García",
  "sujetoObligado": "Universidad Tecnológica XYZ",
  "entidadFederativa": "Morelos",
  "sueldoMaximo": 28964.83,  // o "$28,964.83"
  "sueldoAcumulado": 150000.00,
  "ultimoSueldo": 23651.62
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vista registrada correctamente"
}
```

## 🔒 Cierre graceful

La aplicación maneja correctamente las señales de terminación (SIGINT, SIGTERM):
- Cierra el pool de conexiones a la base de datos
- Finaliza las operaciones pendientes
- Sale limpiamente del proceso

## 📝 Logs

La aplicación genera logs detallados:
- 📡 Nuevas peticiones recibidas
- 🏛️ Filtros aplicados
- ✅ Peticiones exitosas
- ❌ Errores y rechazos
- 🔍 Resultados del procesamiento

## 🧪 Desarrollo

Para desarrollo con auto-reload:
```bash
npm run dev
```

El servidor se reiniciará automáticamente al detectar cambios en los archivos.
