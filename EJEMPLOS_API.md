# Ejemplo de uso del endpoint de vista de profesor

## Usando cURL

```bash
curl -X POST http://localhost:3001/api/profesor-vista \
  -H "Content-Type: application/json" \
  -d '{
    "profesorId": "profesor-erick-mireles-123",
    "nombreProfesor": "ERICK MIRELES MERCHANT",
    "sujetoObligado": "Universidad Tecnológica Emiliano Zapata del Estado de Morelos",
    "entidadFederativa": "Morelos",
    "sueldoMaximo": 28964.83,
    "sueldoAcumulado": 156789.50,
    "ultimoSueldo": 23651.62
  }'
```

## Usando JavaScript/Fetch

```javascript
fetch('http://localhost:3001/api/profesor-vista', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    profesorId: 'profesor-erick-mireles-123',
    nombreProfesor: 'ERICK MIRELES MERCHANT',
    sujetoObligado: 'Universidad Tecnológica Emiliano Zapata del Estado de Morelos',
    entidadFederativa: 'Morelos',
    sueldoMaximo: 28964.83,
    sueldoAcumulado: 156789.50,
    ultimoSueldo: 23651.62
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Con formato de moneda (también soportado)

```javascript
{
  "profesorId": "profesor-juan-perez-456",
  "nombreProfesor": "JUAN PÉREZ GARCÍA",
  "sujetoObligado": "Secretaría de Educación",
  "entidadFederativa": "Ciudad de México",
  "sueldoMaximo": "$35,000.00",
  "sueldoAcumulado": "$420,000.00",
  "ultimoSueldo": "$32,500.00"
}
```

## Respuesta esperada

```json
{
  "success": true,
  "message": "Vista registrada correctamente"
}
```

## Notas

- El `profesorId` puede ser cualquier identificador único que uses en tu frontend
- Los sueldos pueden enviarse como números o como strings con formato de moneda
- La función automáticamente parseará los strings con formato "$1,234.56" a números
- Todos los campos son opcionales excepto que quieras tener datos completos en la BD
- La IP y User Agent se capturan automáticamente del request
