# 🚀 Resumen Rápido - Endpoints de Analytics

## Para copiar y pegar en el frontend

### URLs de los Endpoints

```javascript
const ANALYTICS_API = {
  BASE_URL: 'http://localhost:3001/api/analytics',
  
  // Endpoints disponibles
  NOMBRES_BUSCADOS: '/nombres-mas-buscados',
  PROFESORES_CLICKEADOS: '/profesores-mas-clickeados',
  TOP_SUELDOS: '/top-sueldos',
  BOTTOM_SUELDOS: '/bottom-sueldos',
  STATS_GENERALES: '/estadisticas-generales'
};
```

### Servicio completo listo para usar

```javascript
// services/analyticsService.js

const API_BASE = 'http://localhost:3001/api/analytics';

export const analyticsService = {
  /**
   * Obtiene los nombres más buscados
   * @param {number} limit - Número de resultados (default: 10)
   */
  async getNombresMasBuscados(limit = 10) {
    const response = await fetch(`${API_BASE}/nombres-mas-buscados?limit=${limit}`);
    return response.json();
  },

  /**
   * Obtiene los profesores más clickeados
   * @param {number} limit - Número de resultados (default: 10)
   */
  async getProfesoresMasClickeados(limit = 10) {
    const response = await fetch(`${API_BASE}/profesores-mas-clickeados?limit=${limit}`);
    return response.json();
  },

  /**
   * Obtiene profesores con mayores sueldos acumulados
   * @param {number} limit - Número de resultados (default: 10)
   */
  async getTopSueldos(limit = 10) {
    const response = await fetch(`${API_BASE}/top-sueldos?limit=${limit}`);
    return response.json();
  },

  /**
   * Obtiene profesores con menores sueldos acumulados (>$0)
   * @param {number} limit - Número de resultados (default: 10)
   */
  async getBottomSueldos(limit = 10) {
    const response = await fetch(`${API_BASE}/bottom-sueldos?limit=${limit}`);
    return response.json();
  },

  /**
   * Obtiene estadísticas generales del sistema
   */
  async getEstadisticasGenerales() {
    const response = await fetch(`${API_BASE}/estadisticas-generales`);
    return response.json();
  }
};
```

### Uso en componentes

```javascript
// React Component
import { useEffect, useState } from 'react';
import { analyticsService } from './services/analyticsService';

function Dashboard() {
  const [topBusquedas, setTopBusquedas] = useState([]);

  useEffect(() => {
    analyticsService.getNombresMasBuscados(5)
      .then(result => {
        if (result.success) {
          setTopBusquedas(result.data);
        }
      });
  }, []);

  return (
    <div>
      <h2>Top 5 Búsquedas</h2>
      <ul>
        {topBusquedas.map(item => (
          <li key={item.nombre_profesor}>
            {item.nombre_profesor} - {item.total_busquedas} búsquedas
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Estructura de respuestas

```typescript
// TypeScript interfaces para referencia

interface NombreBuscado {
  nombre_profesor: string;
  total_busquedas: number;
  usuarios_unicos: number;
  ultima_busqueda: string; // ISO timestamp
}

interface ProfesorClickeado {
  nombreProfesor: string;
  sujetoObligado: string;
  entidadFederativa: string;
  totalVistas: number;
  usuariosUnicos: number;
  promedioSueldoMaximo: string; // "12345.67"
  promedioSueldoAcumulado: string; // "123456.78"
  ultimaVista: string; // ISO timestamp
}

interface ProfesorSueldo {
  nombreProfesor: string;
  sujetoObligado: string;
  entidadFederativa: string;
  sueldoAcumulado: string; // "123456.78"
  sueldoMaximo: string; // "12345.67"
  ultimoSueldo: string; // "12345.67"
  totalVistas: number;
  ultimaVista: string; // ISO timestamp
}

interface EstadisticasGenerales {
  totales: {
    busquedas: number;
    vistas: number;
    usuariosUnicos: number;
  };
  ultimas24Horas: {
    busquedas: number;
    vistas: number;
    usuariosNuevos: number;
  };
}

interface AnalyticsResponse<T> {
  success: boolean;
  data: T[];
  total?: number;
  limit?: number;
  tipo?: 'mayores' | 'menores';
  error?: string;
  detail?: string;
}
```

### Testing rápido con fetch

```javascript
// En la consola del navegador o Node.js

// Test 1: Nombres más buscados
fetch('http://localhost:3001/api/analytics/nombres-mas-buscados?limit=3')
  .then(r => r.json())
  .then(console.log);

// Test 2: Profesores más clickeados
fetch('http://localhost:3001/api/analytics/profesores-mas-clickeados?limit=3')
  .then(r => r.json())
  .then(console.log);

// Test 3: Top sueldos
fetch('http://localhost:3001/api/analytics/top-sueldos?limit=3')
  .then(r => r.json())
  .then(console.log);

// Test 4: Bottom sueldos
fetch('http://localhost:3001/api/analytics/bottom-sueldos?limit=3')
  .then(r => r.json())
  .then(console.log);

// Test 5: Stats generales
fetch('http://localhost:3001/api/analytics/estadisticas-generales')
  .then(r => r.json())
  .then(console.log);
```

---

**📖 Documentación completa:** Ver `GUIA_ANALYTICS_FRONTEND.md`
