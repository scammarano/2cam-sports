# Arquitectura S0 y destino

## Entregado en S0

Una instancia Node por sede de laboratorio: API y web adaptable a móvil/tablet. Sin dependencias de internet para operar. Un solo escritor procesa mutaciones síncronamente; persiste estado, auditoría, resultado de idempotencia y eventos juntos en JSON mediante archivo temporal, fsync y rename antes de confirmar. Reinicia desde el último archivo válido. No soporta procesos múltiples, cluster ni réplica; no ejecutar dos instancias sobre el mismo archivo. No sustituye backups y no se promete recuperación de cualquier fallo de disco/energía.

Pistas → encuentros → pantallas de prueba → controles. Cada pantalla apunta a un encuentro; varias pueden compartirlo. Cada control tiene token restringido a pantalla y rol decidido por administrador. Roles auxiliares A/B y anotador oficial. Máximo tres enlaces persistentes por pantalla. Un oficial por encuentro, incluso con varias pantallas. El administrador de mantenimiento tiene acceso separado. El límite global de auxiliares en encuentros con varias pantallas queda pendiente de política.

Puntuación autoritativa en el servicio, sin lógica de juego en el visor. Las reglas se congelan al crear el partido. El cliente envía `expectedVersion`; si otro control ya cambió el estado, se responde 409 y no se aplica esa pulsación. Una clave idempotente permite recuperar el mismo resultado sin sumar de nuevo. El cliente web no reintenta automáticamente tras una respuesta perdida: actualiza y pide revisar el marcador.

El visor usa snapshot cada 500 ms, con una sola solicitud en vuelo por bucle, timeout y espera mayor desconectado. Mantiene último estado atenuado con aviso de desconexión; no inventa puntos locales. El endpoint de eventos permite recuperación incremental de prueba. No hay WSS ni push implementado. No hay SLA ni medición de hardware todavía.

Descubrimiento S0 es el listado de pantallas Sports del servicio cuya dirección conoce la app web. **No es un escaneo LAN entre servicios ni mDNS**. No hay QR ni Bluetooth implementado.

La entrega local es de una sede administrativa y no es multiempresa: un token administrador controla esa instancia. El aislamiento probado es entre credenciales de pantallas y roles. No se presenta como verificación de aislamiento multiempresa del portal futuro.

## Destino acordado

1. Portal PHP/MySQL con BD independiente de Signage, empresas → sedes → instalaciones/pistas; disciplinas, formatos versionados, equipos/jugadores, torneos/jornadas, encuentros y programación.
2. Servicio local con persistencia transaccional y eventos. La autoridad de un encuentro se asigna explícitamente al servicio local; cambios remotos no compiten con él. Fencing/época, migración de autoridad y sincronización central pendientes.
3. Apps remotas incluidas en este repositorio, con descubrimiento, emparejamiento y permisos. Android primero; iOS y Watch con firma y pruebas propias.
4. Signage mantiene pantallas, zonas y publicidad. Recibe estado/eventos de Sports sin consultar tablas ni calcular tanteos. La APK permanece en su repositorio existente.
5. Integración versionada, outbox transaccional, WSS, recuperación por secuencia y fallback. No se insertan credenciales compartidas en playlists.

## Entidades del portal por implementar

companies, sites, venues, courts, disciplines, format_templates, format_versions, participants, teams, team_members, tournaments, rounds, matches, match_participants, match_events, authority_leases, integrations, screen_bindings, control_bindings, user_scope_grants, event_outbox, idempotency_requests, audit_log, migrations.

Todas las operaciones del portal deberán validar empresa/sede en backend. S0 no modifica archivos ni tablas de Digital Signage o de Turnos.
