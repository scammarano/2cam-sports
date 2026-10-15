# API local S0 · /api/v1

Este contrato técnico es del servicio local de prueba; no se declara aprobado para el consumidor APK. HTTPS y autenticación servidor-servidor deberán cerrarse con Digital Signage.

| Método/ruta | Autorización | Propósito |
|---|---|---|
| GET /health | Pública | Salud sin secretos |
| GET /presets | Pública | Plantillas |
| GET /discovery | Pública en LAN de laboratorio | Solo nombres/IDs de pantallas Sports y cupos |
| GET /admin | Administrador | Pistas, encuentros, controles sin tokens |
| POST /courts | Administrador | `{name}` |
| POST /matches | Administrador | `{courtId,names:[A,B],scheduledAt,firstServer,format}` |
| POST /matches/{id}/start | Administrador | Iniciar con exclusión de pista |
| POST /screens | Administrador | `{name,matchId}`; devuelve ID y token de visor una vez |
| POST /screens/{id}/pairing | Administrador | `{role:official\|home\|away}`; código de un uso por 2 minutos |
| POST /screens/{id}/pair | Código temporal | `{name,code}`; devuelve token de control una vez |
| POST /screens/{id}/revoke | Administrador | `{controlId}`; libera cupo |
| GET /screens/{id}/snapshot | Visor/control de esa pantalla o admin | Estado, versión, secuencia, rol; código solo a visor/admin |
| GET /screens/{id}/events?after_sequence=N | Igual que snapshot | Eventos autorizados y último cursor global |
| POST /screens/{id}/commands | Control autorizado o admin | Comando versionado e idempotente |

Tokens en `Authorization: Bearer TOKEN`, nunca en query de API. El enlace privado de visor usa fragmento, lo retira de la barra y lo conserva en sessionStorage; es una credencial que se debe proteger. Sin cookies ni scripts externos. Tokens de dispositivos guardados como hash en el servidor.

Comando:

```json
{"type":"point","side":0,"expectedVersion":1}
```

O `{"type":"undo","expectedVersion":2}`. Encabezado obligatorio `Idempotency-Key`, 8–100 caracteres alfanuméricos/guion/guion bajo. Identidad de clave por actor. Misma clave y contenido recupera respuesta original; otro contenido devuelve 409. Conflicto de versión también 409. Reautorización antes de recuperar respuesta, por lo que revocar un token bloquea reintentos.

Formato:

```json
{
  "discipline":"tennis",
  "bestOf":3,
  "deuce":"advantage",
  "set":{"kind":"games","games":6,"tiebreakAt":6,"tiebreakPoints":7},
  "decidingSet":{"kind":"match_tiebreak","points":10}
}
```

`deuce`: advantage/golden/star (star solo pádel). Set decisivo propio con kind games o reemplazo match_tiebreak. `tiebreakAt:null` significa set sin tiebreak. Todo desempate exige diferencia de dos puntos. No hay opción de punto final con límite duro en S0.

Secuencia global del servicio local S0, no por pantalla ni por encuentro. Puede haber saltos en el subconjunto autorizado: usar `lastSequence` como cursor de lectura; no inferir pérdida por un salto. Snapshot y cursor se obtienen sin intercalar mutaciones. Logs/eventos se conservan sin poda en S0; no existe protocolo de brecha por retención todavía.

Errores JSON con mensaje público: 400 JSON incorrecto, 401 credencial, 403 permisos/código, 404 registro, 409 conflicto/cupo/pista, 413 tamaño, 415 tipo, 422 configuración y 429 intentos de enlace. No se exponen trazas ni claves.
