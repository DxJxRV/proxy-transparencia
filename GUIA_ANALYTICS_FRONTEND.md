# 📊 Guía de Endpoints de Analytics - Para Frontend

## 🎯 Descripción General

La API proporciona **5 endpoints de analytics** para obtener estadísticas y rankings de profesores basados en los datos de búsquedas y vistas registradas en la base de datos.

**Base URL:** `http://localhost:3001/api/analytics`

---

## 📋 Endpoints Disponibles

### 1. 🔍 Nombres Más Buscados

**Endpoint:** `GET /api/analytics/nombres-mas-buscados`

**Descripción:** Obtiene un ranking de los nombres de profesores más buscados en la plataforma.

**Query Parameters:**
- `limit` (opcional): Número de resultados a retornar. Default: `10`

**Request:**
```javascript
// Con límite personalizado
fetch('http://localhost:3001/api/analytics/nombres-mas-buscados?limit=20')
  .then(res => res.json())
  .then(data => console.log(data));

// Sin límite (usa default de 10)
fetch('http://localhost:3001/api/analytics/nombres-mas-buscados')
  .then(res => res.json())
  .then(data => console.log(data));
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nombre_profesor": "JUAN PÉREZ GARCÍA",
      "total_busquedas": 145,
      "usuarios_unicos": 78,
      "ultima_busqueda": "2025-10-16T14:30:00.000Z"
    },
    {
      "nombre_profesor": "MARÍA LÓPEZ HERNÁNDEZ",
      "total_busquedas": 132,
      "usuarios_unicos": 65,
      "ultima_busqueda": "2025-10-16T13:15:00.000Z"
    }
  ],
  "total": 2,
  "limit": 10
}
```

**Campos de respuesta:**
- `nombre_profesor`: Nombre completo del profesor
- `total_busquedas`: Número total de veces que se buscó este nombre
- `usuarios_unicos`: Número de usuarios diferentes que lo buscaron
- `ultima_busqueda`: Timestamp de la búsqueda más reciente

---

### 2. 👁️ Profesores Más Clickeados

**Endpoint:** `GET /api/analytics/profesores-mas-clickeados`

**Descripción:** Obtiene un ranking de los profesores cuyas cards fueron más vistas/clickeadas.

**Query Parameters:**
- `limit` (opcional): Número de resultados a retornar. Default: `10`

**Request:**
```javascript
// React/Vue/Angular example
async function getProfesoresMasVistos(limit = 15) {
  const response = await fetch(
    `http://localhost:3001/api/analytics/profesores-mas-clickeados?limit=${limit}`
  );
  const data = await response.json();
  return data;
}

// Usage
const topProfesores = await getProfesoresMasVistos(15);
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "CARLOS RAMÍREZ SOTO",
      "sujetoObligado": "Universidad Autónoma de Morelos",
      "entidadFederativa": "Morelos",
      "totalVistas": 256,
      "usuariosUnicos": 189,
      "promedioSueldoMaximo": "45678.50",
      "promedioSueldoAcumulado": "523456.75",
      "ultimaVista": "2025-10-16T15:45:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10
}
```

**Campos de respuesta:**
- `nombreProfesor`: Nombre completo del profesor
- `sujetoObligado`: Institución donde trabaja
- `entidadFederativa`: Estado/entidad
- `totalVistas`: Número total de vistas a la card
- `usuariosUnicos`: Usuarios diferentes que vieron la card
- `promedioSueldoMaximo`: Promedio del sueldo máximo registrado (string con 2 decimales)
- `promedioSueldoAcumulado`: Promedio del sueldo acumulado (string con 2 decimales)
- `ultimaVista`: Timestamp de la vista más reciente

---

### 3. 💰 Top Sueldos Acumulados (Mayores)

**Endpoint:** `GET /api/analytics/top-sueldos`

**Descripción:** Obtiene los profesores con los sueldos acumulados más altos.

**Query Parameters:**
- `limit` (opcional): Número de resultados a retornar. Default: `10`

**Request:**
```javascript
// Axios example
import axios from 'axios';

const getTopSalarios = async (cantidad = 20) => {
  try {
    const { data } = await axios.get(
      'http://localhost:3001/api/analytics/top-sueldos',
      { params: { limit: cantidad } }
    );
    return data;
  } catch (error) {
    console.error('Error al obtener top salarios:', error);
    throw error;
  }
};

// Usage
const topSalarios = await getTopSalarios(20);
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "ROBERTO GONZÁLEZ MARTÍNEZ",
      "sujetoObligado": "Instituto Tecnológico de Morelos",
      "entidadFederativa": "Morelos",
      "sueldoAcumulado": "1250000.50",
      "sueldoMaximo": "75000.00",
      "ultimoSueldo": "68500.00",
      "totalVistas": 45,
      "ultimaVista": "2025-10-16T12:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "tipo": "mayores"
}
```

**Campos de respuesta:**
- `nombreProfesor`: Nombre completo
- `sujetoObligado`: Institución
- `entidadFederativa`: Estado
- `sueldoAcumulado`: Suma total de sueldos (string con 2 decimales)
- `sueldoMaximo`: Sueldo más alto registrado (string con 2 decimales)
- `ultimoSueldo`: Último sueldo reportado (string con 2 decimales)
- `totalVistas`: Veces que se vio su card
- `ultimaVista`: Timestamp de última vista
- `tipo`: `"mayores"` - indica que son los sueldos más altos

---

### 4. 💸 Bottom Sueldos Acumulados (Menores)

**Endpoint:** `GET /api/analytics/bottom-sueldos`

**Descripción:** Obtiene los profesores con los sueldos acumulados más bajos (excluyendo $0).

**Query Parameters:**
- `limit` (opcional): Número de resultados a retornar. Default: `10`

**Request:**
```javascript
// Fetch con async/await
const getBottomSalarios = async (limit = 10) => {
  const url = new URL('http://localhost:3001/api/analytics/bottom-sueldos');
  url.searchParams.append('limit', limit);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data;
};

// Usage
try {
  const bottomSalarios = await getBottomSalarios(10);
  console.log('Sueldos más bajos:', bottomSalarios.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "nombreProfesor": "ANA MARTÍNEZ FLORES",
      "sujetoObligado": "Escuela Normal de Morelos",
      "entidadFederativa": "Morelos",
      "sueldoAcumulado": "12500.00",
      "sueldoMaximo": "8500.00",
      "ultimoSueldo": "7800.00",
      "totalVistas": 12,
      "ultimaVista": "2025-10-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "tipo": "menores"
}
```

**Campos de respuesta:**
- Mismos campos que `top-sueldos`
- `tipo`: `"menores"` - indica que son los sueldos más bajos
- **Nota:** Excluye automáticamente profesores con sueldo acumulado = $0

---

### 5. 📈 Estadísticas Generales

**Endpoint:** `GET /api/analytics/estadisticas-generales`

**Descripción:** Obtiene métricas generales del sistema (totales y actividad reciente).

**Query Parameters:** Ninguno

**Request:**
```javascript
// Simple fetch
fetch('http://localhost:3001/api/analytics/estadisticas-generales')
  .then(res => res.json())
  .then(stats => {
    console.log('Total búsquedas:', stats.data.totales.busquedas);
    console.log('Búsquedas últimas 24h:', stats.data.ultimas24Horas.busquedas);
  });
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totales": {
      "busquedas": 5432,
      "vistas": 3210,
      "usuariosUnicos": 1250
    },
    "ultimas24Horas": {
      "busquedas": 145,
      "vistas": 89,
      "usuariosNuevos": 23
    }
  }
}
```

**Campos de respuesta:**
- `totales`: Estadísticas acumuladas desde el inicio
  - `busquedas`: Total de consultas realizadas
  - `vistas`: Total de vistas a cards de profesores
  - `usuariosUnicos`: Total de usuarios únicos registrados
- `ultimas24Horas`: Actividad en las últimas 24 horas
  - `busquedas`: Consultas en las últimas 24h
  - `vistas`: Vistas en las últimas 24h
  - `usuariosNuevos`: Nuevos usuarios en las últimas 24h

---

## 🎨 Ejemplos de Implementación en Frontend

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function AnalyticsDashboard() {
  const [topBusquedas, setTopBusquedas] = useState([]);
  const [topClickeados, setTopClickeados] = useState([]);
  const [topSueldos, setTopSueldos] = useState([]);
  const [bottomSueldos, setBottomSueldos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost:3001/api/analytics';

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [busquedas, clickeados, top, bottom, generales] = await Promise.all([
          fetch(`${API_BASE}/nombres-mas-buscados?limit=5`).then(r => r.json()),
          fetch(`${API_BASE}/profesores-mas-clickeados?limit=5`).then(r => r.json()),
          fetch(`${API_BASE}/top-sueldos?limit=5`).then(r => r.json()),
          fetch(`${API_BASE}/bottom-sueldos?limit=5`).then(r => r.json()),
          fetch(`${API_BASE}/estadisticas-generales`).then(r => r.json())
        ]);

        setTopBusquedas(busquedas.data);
        setTopClickeados(clickeados.data);
        setTopSueldos(top.data);
        setBottomSueldos(bottom.data);
        setStats(generales.data);
        setLoading(false);
      } catch (error) {
        console.error('Error cargando analytics:', error);
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <div>Cargando estadísticas...</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Dashboard de Analytics</h1>
      
      {/* Estadísticas Generales */}
      <div className="stats-overview">
        <h2>Resumen General</h2>
        <div className="stat-card">
          <h3>Total Búsquedas</h3>
          <p>{stats.totales.busquedas.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Últimas 24h</h3>
          <p>{stats.ultimas24Horas.busquedas} búsquedas</p>
        </div>
      </div>

      {/* Nombres más buscados */}
      <div className="top-searches">
        <h2>Top 5 - Nombres Más Buscados</h2>
        <ul>
          {topBusquedas.map((item, idx) => (
            <li key={idx}>
              {item.nombre_profesor} - {item.total_busquedas} búsquedas
            </li>
          ))}
        </ul>
      </div>

      {/* Profesores más clickeados */}
      <div className="top-clicks">
        <h2>Top 5 - Profesores Más Vistos</h2>
        <ul>
          {topClickeados.map((prof, idx) => (
            <li key={idx}>
              {prof.nombreProfesor} ({prof.sujetoObligado}) - {prof.totalVistas} vistas
            </li>
          ))}
        </ul>
      </div>

      {/* Top Sueldos */}
      <div className="top-salaries">
        <h2>Top 5 - Mayores Sueldos Acumulados</h2>
        <ul>
          {topSueldos.map((prof, idx) => (
            <li key={idx}>
              {prof.nombreProfesor} - ${parseFloat(prof.sueldoAcumulado).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom Sueldos */}
      <div className="bottom-salaries">
        <h2>Top 5 - Menores Sueldos Acumulados</h2>
        <ul>
          {bottomSueldos.map((prof, idx) => (
            <li key={idx}>
              {prof.nombreProfesor} - ${parseFloat(prof.sueldoAcumulado).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
```

### Vue 3 Composition API Example

```vue
<template>
  <div class="analytics">
    <h1>Analytics Dashboard</h1>
    
    <div v-if="loading">Cargando...</div>
    
    <div v-else>
      <section class="general-stats">
        <h2>Estadísticas Generales</h2>
        <p>Total búsquedas: {{ stats?.totales.busquedas }}</p>
        <p>Últimas 24h: {{ stats?.ultimas24Horas.busquedas }}</p>
      </section>

      <section class="top-searches">
        <h2>Top {{ limit }} - Más Buscados</h2>
        <ul>
          <li v-for="item in topBusquedas" :key="item.nombre_profesor">
            {{ item.nombre_profesor }} ({{ item.total_busquedas }} búsquedas)
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const API_BASE = 'http://localhost:3001/api/analytics';
const limit = ref(10);
const loading = ref(true);
const topBusquedas = ref([]);
const stats = ref(null);

const fetchAnalytics = async () => {
  try {
    const [busquedasRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/nombres-mas-buscados?limit=${limit.value}`),
      fetch(`${API_BASE}/estadisticas-generales`)
    ]);

    topBusquedas.value = (await busquedasRes.json()).data;
    stats.value = (await statsRes.json()).data;
    loading.value = false;
  } catch (error) {
    console.error('Error:', error);
    loading.value = false;
  }
};

onMounted(() => {
  fetchAnalytics();
});
</script>
```

---

## 🔑 Notas Importantes

1. **CORS**: El servidor ya tiene CORS habilitado para `*` (todos los orígenes). Si necesitas restringirlo, modifica `ALLOWED_ORIGIN` en el `.env`

2. **Límites**: Todos los endpoints que aceptan `limit` tienen un default de `10` si no se especifica

3. **Decimales en sueldos**: Los campos de sueldo vienen como strings con 2 decimales fijos (ej: `"45678.50"`)

4. **Timestamps**: Todos los timestamps están en formato ISO 8601 UTC

5. **Manejo de errores**: Todos los endpoints devuelven `success: true/false`. Siempre verifica este campo antes de usar `data`

6. **Performance**: Los endpoints usan índices en la BD para queries rápidas, pero con grandes volúmenes de datos considera implementar caché

---

## 🚀 Testing Rápido con cURL

```bash
# Nombres más buscados
curl "http://localhost:3001/api/analytics/nombres-mas-buscados?limit=5"

# Profesores más clickeados
curl "http://localhost:3001/api/analytics/profesores-mas-clickeados?limit=5"

# Top sueldos
curl "http://localhost:3001/api/analytics/top-sueldos?limit=5"

# Bottom sueldos
curl "http://localhost:3001/api/analytics/bottom-sueldos?limit=5"

# Estadísticas generales
curl "http://localhost:3001/api/analytics/estadisticas-generales"
```

---

## 📊 Resumen de Endpoints

| Endpoint | Método | Parámetros | Descripción |
|----------|--------|------------|-------------|
| `/api/analytics/nombres-mas-buscados` | GET | `?limit=10` | Ranking de nombres más buscados |
| `/api/analytics/profesores-mas-clickeados` | GET | `?limit=10` | Ranking de profesores más vistos |
| `/api/analytics/top-sueldos` | GET | `?limit=10` | Mayores sueldos acumulados |
| `/api/analytics/bottom-sueldos` | GET | `?limit=10` | Menores sueldos (excluyendo $0) |
| `/api/analytics/estadisticas-generales` | GET | - | Métricas generales del sistema |

---

**¿Dudas o necesitas más ejemplos?** Todos los endpoints están documentados y listos para usar. ¡Happy coding! 🎉
