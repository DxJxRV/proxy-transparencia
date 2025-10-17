# 📊 Guía de API de Analytics - Mini Proxy Transparencia

## 🎯 Descripción General

Esta API proporciona endpoints para obtener estadísticas y analytics sobre búsquedas y vistas de profesores en la plataforma de transparencia.

**Base URL:** `http://tu-servidor:3000/api/analytics`

---

## 📌 Endpoints Disponibles

### 1. Nombres Más Buscados
**GET** `/api/analytics/nombres-mas-buscados?limit=20`

Obtiene los nombres de profesores más buscados en el sistema.

#### Parámetros Query
| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `limit` | number | No | 10 | Número de resultados a retornar |

#### Respuesta Exitosa (200)
```json
{
  "success": true,
  "data": [
    {
      "nombre_profesor": "JUAN PEREZ GARCIA",
      "total_busquedas": 45,
      "usuarios_unicos": 23,
      "ultima_busqueda": "2025-10-17T10:30:00.000Z"
    }
  ],
  "total": 20,
  "totalReal": 1543,
  "limit": 20
}
```

#### Campos de Respuesta
- **data**: Array de resultados limitados por `limit`
- **total**: Cantidad de elementos en el array `data`
- **totalReal**: Total de nombres únicos en toda la base de datos (para paginación)
- **limit**: Límite aplicado en la consulta

---

### 2. Profesores Más Clickeados
**GET** `/api/analytics/profesores-mas-clickeados?limit=20`

Obtiene los profesores con más vistas (clicks en sus tarjetas/cards).

#### Parámetros Query
| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `limit` | number | No | 10 | Número de resultados a retornar |

#### Respuesta Exitosa (200)
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "MARIA GONZALEZ LOPEZ",
      "sujetoObligado": "UNIVERSIDAD AUTONOMA DE MEXICO",
      "entidadFederativa": "CIUDAD DE MEXICO",
      "totalVistas": 156,
      "usuariosUnicos": 78,
      "promedioSueldoMaximo": "45000.50",
      "promedioSueldoAcumulado": "540000.00",
      "ultimaVista": "2025-10-17T15:45:00.000Z"
    }
  ],
  "total": 20,
  "totalReal": 8234,
  "totalVistasAcumuladas": 45632,
  "limit": 20
}
```

#### Campos de Respuesta
- **data**: Array de profesores con sus estadísticas
- **total**: Cantidad de elementos en el array `data`
- **totalReal**: Total de combinaciones únicas (nombre + institución + estado) en toda la BD
- **totalVistasAcumuladas**: Suma total de TODAS las vistas de TODOS los profesores únicos
- **limit**: Límite aplicado

#### 💡 Uso del totalVistasAcumuladas
Este campo te permite mostrar estadísticas globales como:
- "Se han visualizado **45,632** profesores en total"
- Calcular porcentaje: "Los 20 profesores mostrados representan el X% del total de vistas"

---

### 3. Top Sueldos Acumulados
**GET** `/api/analytics/profesores-top-sueldo?limit=20`

Obtiene los profesores con los sueldos acumulados más altos (excluye sueldos en $0).

#### Parámetros Query
| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `limit` | number | No | 10 | Número de resultados a retornar |

#### Respuesta Exitosa (200)
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "ROBERTO MARTINEZ SILVA",
      "sujetoObligado": "INSTITUTO TECNOLOGICO SUPERIOR",
      "entidadFederativa": "JALISCO",
      "sueldoAcumulado": "1250000.00",
      "sueldoMaximo": "85000.00",
      "ultimoSueldo": "82000.00",
      "totalVistas": 89,
      "ultimaVista": "2025-10-17T12:00:00.000Z"
    }
  ],
  "total": 20,
  "totalReal": 7891,
  "totalVistasAcumuladas": 34521,
  "limit": 20,
  "tipo": "mayores"
}
```

#### Campos Especiales
- **sueldoAcumulado**: Suma total de todos los sueldos del profesor
- **sueldoMaximo**: El sueldo más alto registrado
- **ultimoSueldo**: El último sueldo conocido
- **tipo**: `"mayores"` para identificar que son los sueldos más altos
- **totalVistasAcumuladas**: Total de vistas de todos los profesores con sueldo > 0

---

### 4. Bottom Sueldos Acumulados
**GET** `/api/analytics/profesores-bottom-sueldo?limit=20`

Obtiene los profesores con los sueldos acumulados más bajos (excluye sueldos en $0).

#### Parámetros Query
| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `limit` | number | No | 10 | Número de resultados a retornar |

#### Respuesta Exitosa (200)
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "LUIS HERNANDEZ TORRES",
      "sujetoObligado": "COLEGIO DE BACHILLERES",
      "entidadFederativa": "OAXACA",
      "sueldoAcumulado": "15000.00",
      "sueldoMaximo": "8500.00",
      "ultimoSueldo": "7200.00",
      "totalVistas": 12,
      "ultimaVista": "2025-10-15T09:30:00.000Z"
    }
  ],
  "total": 20,
  "totalReal": 7891,
  "totalVistasAcumuladas": 34521,
  "limit": 20,
  "tipo": "menores"
}
```

#### Campos Especiales
- **tipo**: `"menores"` para identificar que son los sueldos más bajos
- **totalVistasAcumuladas**: Mismo valor que top (total de vistas de profesores con sueldo > 0)

---

### 5. Estadísticas Generales
**GET** `/api/analytics/estadisticas-generales`

Obtiene un resumen de las estadísticas del sistema.

#### Sin Parámetros

#### Respuesta Exitosa (200)
```json
{
  "success": true,
  "data": {
    "totales": {
      "busquedas": 15234,
      "vistas": 45632,
      "usuariosUnicos": 3421
    },
    "ultimas24Horas": {
      "busquedas": 234,
      "vistas": 567,
      "usuariosNuevos": 45
    }
  }
}
```

#### Uso Recomendado
Ideal para un **dashboard de estadísticas generales** que muestre:
- Actividad total del sistema
- Actividad reciente (últimas 24 horas)
- Métricas de usuarios

---

## ⚠️ Manejo de Errores

Todos los endpoints devuelven la misma estructura en caso de error:

```json
{
  "success": false,
  "error": "Descripción del error",
  "detail": "Mensaje técnico del error (solo en desarrollo)"
}
```

### Códigos de Estado HTTP
- **200**: Éxito
- **400**: Bad Request (parámetros inválidos)
- **500**: Error interno del servidor

---

## 🎨 Ejemplos de Uso en Frontend

### Ejemplo 1: Tabla con Paginación

```javascript
// React + Axios
async function fetchNombresMasBuscados(limit = 20) {
  try {
    const response = await axios.get('/api/analytics/nombres-mas-buscados', {
      params: { limit }
    });
    
    if (response.data.success) {
      const { data, total, totalReal } = response.data;
      
      console.log(`Mostrando ${total} de ${totalReal} nombres`);
      // Renderiza la tabla con 'data'
      // Configura la paginación con 'totalReal'
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Ejemplo 2: Dashboard con Estadísticas

```javascript
// Vue.js
async mounted() {
  try {
    const [generales, topClickeados] = await Promise.all([
      fetch('/api/analytics/estadisticas-generales').then(r => r.json()),
      fetch('/api/analytics/profesores-mas-clickeados?limit=5').then(r => r.json())
    ]);
    
    // Mostrar métricas generales
    this.totalBusquedas = generales.data.totales.busquedas;
    
    // Mostrar top 5 profesores
    this.topProfesores = topClickeados.data;
    
    // Mostrar estadística global
    this.totalVistas = topClickeados.totalVistasAcumuladas;
  } catch (error) {
    this.error = 'Error al cargar estadísticas';
  }
}
```

### Ejemplo 3: Comparación de Sueldos

```javascript
// Svelte
let topSueldos = [];
let bottomSueldos = [];
let totalProfesores = 0;

async function loadComparacion() {
  const [top, bottom] = await Promise.all([
    fetch('/api/analytics/profesores-top-sueldo?limit=10'),
    fetch('/api/analytics/profesores-bottom-sueldo?limit=10')
  ]).then(responses => Promise.all(responses.map(r => r.json())));
  
  topSueldos = top.data;
  bottomSueldos = bottom.data;
  totalProfesores = top.totalReal; // Mismo en ambos
  
  // Renderizar comparación lado a lado
}
```

---

## 📊 Casos de Uso Recomendados

### 1. **Página de Analytics Principal**
```
┌─────────────────────────────────────┐
│  📊 Estadísticas Generales          │
│  • 15,234 búsquedas totales         │
│  • 45,632 vistas de profesores      │
│  • 3,421 usuarios únicos            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🔍 Nombres Más Buscados (Top 20)   │
│  Mostrando 20 de 1,543              │
│  [Tabla con paginación]             │
└─────────────────────────────────────┘
```

### 2. **Ranking de Profesores**
```
┌──────────────────────────────────────┐
│  👥 Profesores Más Vistos            │
│  Total de vistas: 45,632             │
│  Profesores únicos: 8,234            │
│                                      │
│  [Top 20 con avatares y stats]       │
└──────────────────────────────────────┘
```

### 3. **Análisis de Sueldos**
```
┌───────────────┬───────────────┐
│ 💰 Top 10     │ 📉 Bottom 10  │
│ Mayores       │ Menores       │
│ Sueldos       │ Sueldos       │
│               │               │
│ [Lista]       │ [Lista]       │
│               │               │
│ Total profesores con sueldo:  │
│ 7,891                         │
└───────────────────────────────┘
```

---

## 🎯 Tips de Implementación

### 1. **Paginación Eficiente**
```javascript
// Usa totalReal para calcular páginas
const totalPaginas = Math.ceil(totalReal / limit);
const paginaActual = offset / limit + 1;

// Muestra: "Mostrando 1-20 de 1,543"
const inicio = offset + 1;
const fin = Math.min(offset + limit, totalReal);
```

### 2. **Formateo de Números**
```javascript
// Formatear sueldos
const formatearSueldo = (sueldo) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(sueldo);
};

// Formatear números grandes
const formatearNumero = (num) => {
  return new Intl.NumberFormat('es-MX').format(num);
};
```

### 3. **Caché y Optimización**
```javascript
// Cachear estadísticas generales (cambian poco)
const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

let cachedStats = null;
let cacheTime = 0;

async function getEstadisticas() {
  const now = Date.now();
  
  if (cachedStats && (now - cacheTime) < CACHE_TIME) {
    return cachedStats;
  }
  
  const response = await fetch('/api/analytics/estadisticas-generales');
  cachedStats = await response.json();
  cacheTime = now;
  
  return cachedStats;
}
```

### 4. **Manejo de Estados de Carga**
```javascript
// React Hook personalizado
function useAnalytics(endpoint, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`/api/analytics/${endpoint}?${queryString}`);
        const result = await response.json();
        
        if (result.success) {
          setData(result);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [endpoint, JSON.stringify(params)]);
  
  return { data, loading, error };
}

// Uso:
// const { data, loading, error } = useAnalytics('nombres-mas-buscados', { limit: 20 });
```

---

## 🔐 Consideraciones de Seguridad

1. **Rate Limiting**: Los endpoints no tienen rate limiting. Considera implementarlo en el frontend.
2. **CORS**: Configurado para permitir requests desde el dominio principal.
3. **Validación**: El servidor valida que `limit` sea un número válido (default: 10).

---

## 📝 Notas Adicionales

### Diferencia entre `total` y `totalReal`
- **total**: Cantidad de elementos en el array `data` (máximo = limit)
- **totalReal**: Total de registros en la base de datos SIN el límite

**Ejemplo:**
```json
{
  "data": [...], // 20 elementos
  "total": 20,    // Cantidad en este response
  "totalReal": 1543, // Total en la BD
  "limit": 20
}
```

### Diferencia entre `totalVistas` y `totalVistasAcumuladas`
- **totalVistas**: Vistas de UN profesor específico
- **totalVistasAcumuladas**: Suma de TODAS las vistas de TODOS los profesores únicos

**Ejemplo:**
```json
{
  "data": [
    { "nombreProfesor": "A", "totalVistas": 100 },
    { "nombreProfesor": "B", "totalVistas": 50 }
  ],
  "total": 2,
  "totalReal": 8234,
  "totalVistasAcumuladas": 45632  // Suma de TODOS los 8,234 profesores
}
```

---

## 📞 Soporte

Si encuentras algún error o necesitas un nuevo endpoint, contacta al equipo de backend.

**Última actualización:** Octubre 17, 2025
