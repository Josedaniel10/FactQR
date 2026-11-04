# Implementación de Webhook — Factus Pay

## Objetivo

Implementar un webhook de Factus Pay utilizando:

- React como frontend.
- Vercel para el despliegue y funciones backend.
- Supabase como base de datos.

> El webhook NO debe implementarse en React. Debe procesarse desde una función backend en Vercel.

---

## Arquitectura

```text
Usuario
   ↓
React
   ↓
Factus Pay procesa el pago
   ↓
Factus Pay envía webhook
   ↓
Vercel Serverless Function
   ↓
Validar llave secreta
   ↓
Actualizar Supabase
   ↓
React obtiene el nuevo estado del pago

Endpoint
Crear un endpoint público:
POST /api/webhooks/factus-pay

URL de producción:
https://TU-DOMINIO.vercel.app/api/webhooks/factus-pay

Esta URL debe registrarse en el panel de Factus Pay.

Factus Pay enviará algo similar a:
POST https://TU-DOMINIO.vercel.app/api/webhooks/factus-pay?key=TU_LLAVE_SECRETA
Content-Type: application/json

Validación de seguridad
Factus Pay enviará una llave llamada key en la URL.

El backend debe validar:
key recibida === FACTUS_WEBHOOK_KEY

Si no coincide:
401 Unauthorized

La llave debe ser secreta, aleatoria y tener al menos 32 caracteres.
Variables de entorno
Configurar en Vercel:
FACTUS_WEBHOOK_KEY=tu_llave_secreta
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

Importante
- Nunca exponer estas claves en React.
- Nunca usar VITE_* para secretos.
- SUPABASE_SERVICE_ROLE_KEY solo puede utilizarse en el backend.
Procesamiento del webhook
La función debe:
1. Aceptar únicamente POST.
2. Validar la key.
3. Leer el cuerpo JSON enviado por Factus Pay.
4. Identificar la transacción utilizando el identificador único enviado por Factus Pay.
5. Buscar el pago correspondiente en Supabase.
6. Actualizar su estado según la información real recibida.
7. Responder 200 OK si se procesó correctamente.
No asumir todavía los nombres exactos de los campos del payload. Revisar la documentación o el JSON real de Factus Pay antes de implementar el mapeo.
Flujo de pagos
Pago creado
    ↓
status: pending
    ↓
Usuario paga
    ↓
Factus Pay envía webhook
    ↓
Vercel valida la petición
    ↓
Supabase actualiza el pago
    ↓
React muestra el estado actualizado

Idempotencia
El webhook debe poder recibirse más de una vez sin generar efectos duplicados.

Usar el identificador único de la transacción o evento para evitar:
- Pagos duplicados.
- Actualizaciones incorrectas.
- Entregas o acciones ejecutadas múltiples veces.
React y actualización del estado
React no debe considerar un pago exitoso únicamente porque el usuario fue redirigido a una página como:
/pago-exitoso

La fuente de verdad debe ser:
Factus Pay → Webhook → Vercel → Supabase

El frontend debe consultar el estado real en Supabase o recibir los cambios mediante Supabase Realtime.
Respuestas HTTP
200 → Webhook procesado correctamente
401 → Llave inválida
405 → Método no permitido
500 → Error interno