# 2Cam Sports · 0.1.0 · S0

Primera entrega técnica ejecutable: motor de tenis/pádel, pistas, encuentros, visor web y controles locales. **No es todavía el portal completo ni una APK.** No requiere paquetes npm externos.

## Ejecutar

Requiere Node.js 22 o 24. Desde la carpeta del proyecto:

PowerShell (Windows):

```powershell
$env:SPORTS_ADMIN_TOKEN = Read-Host 'Define una clave local de al menos 24 caracteres'
npm start
```

Bash:

```bash
read -r -s -p 'Clave local (24 caracteres o más): ' SPORTS_ADMIN_TOKEN
export SPORTS_ADMIN_TOKEN
npm start
```

Abrir `http://127.0.0.1:8787`. Introducir la misma clave en Administración. La clave no se escribe en el código ni se publica en el repositorio. El proceso no la imprime.

Por defecto solo escucha en el equipo local. Para un laboratorio LAN aislado, definir `SPORTS_HOST=0.0.0.0` (PowerShell: `$env:SPORTS_HOST='0.0.0.0'`) antes de arrancar y abrir `http://IP-DEL-EQUIPO:8787` en tablet y pantallas. Permitir el puerto en la red privada del firewall. El equipo anfitrión debe permanecer encendido. No necesita internet durante la operación.

Este prototipo sirve HTTP: para despliegue real debe situarse detrás de HTTPS con certificados confiables; no exponerlo a internet. No se presentan las credenciales por HTTP como solución de producción.

## Primera prueba

1. Crear pista/cancha.
2. Crear encuentro, elegir tenis o pádel y plantilla. Ajustar games, sets, iguales y desempates. El formulario diferencia games de sets.
3. Iniciar encuentro: solo uno activo por pista.
4. Crear pantalla de prueba asociada al encuentro y abrir/guardar su enlace privado de visor.
5. Abrir enlace de control desde Administración, eligiendo Anotador oficial, Auxiliar A o Auxiliar B.
6. En otro navegador abrir el mismo servidor → Control remoto → Buscar pantallas. Elegir pantalla e introducir el código visible. El código vence a los dos minutos, es de un uso y se bloquea tras cinco errores.
7. Repetir hasta tres controles por pantalla. Un dispositivo desconectado conserva cupo; el administrador puede revocarlo.
8. Sumar puntos; probar iguales y desempates. El anotador oficial puede deshacer el último punto; auxiliares solo suman al lado autorizado.

Dos visores vinculados al mismo encuentro reciben el mismo estado. Máximo un control oficial por encuentro; máximo tres controles por pantalla. El administrador local conserva acceso de mantenimiento y no se contabiliza como dispositivo emparejado.

La clave de administrador se conserva solo en memoria de la página; controles/visores conservan su token en `sessionStorage` de esa pestaña. No hay reanudación permanente nativa ni recuperación del enlace de visor perdido en esta versión.

## Formatos implementados

- Tenis y pádel: 0–15–30–40, ventaja; punto de oro/sin ventaja.
- Star Point para pádel: dos ciclos de ventaja; punto decisivo al tercer iguales.
- Mejor de 1, 3 o 5 sets; gana quien alcanza la mayoría.
- Games por set entre 2 y 20, incluyendo sets cortos y proset a 8.
- Diferencia de dos games; tiebreak al igualar en el objetivo o un game antes, o set sin tiebreak.
- Tiebreak con objetivo configurable y diferencia de dos puntos.
- Regla propia para el set decisivo: games/tiebreak o supertiebreak que sustituye todo el set.
- Dos sets + supertiebreak: si un lado gana 2–0, el partido termina sin jugar supertiebreak.
- Indicador del lado al saque, incluida rotación 1/2/2 del tiebreak. Orden individual de los cuatro jugadores pendiente.
- Reglas congeladas por encuentro, corrección por deshacer y auditoría de actor/versión.

El proset se etiqueta como variante configurable, no como formato universal de una federación. Estas reglas controlan la puntuación, no adjudican faltas, lets, sanciones u otras decisiones arbitrales.

## Verificación

```bash
npm run check
npm test
```

Pruebas de motor, límites y permisos, dos pantallas, idempotencia, conflicto concurrente HTTP, repetición tras reinicio y persistencia. CI está configurado para Node 22/24 y empaqueta un ZIP técnico; **no compila una APK**. Ver el resultado real de Actions antes de dar CI por aprobado.

## Alcance y siguientes entregas

Consultar [arquitectura](docs/ARCHITECTURE.md), [contrato local](docs/CONTRACT.md), [fuentes](docs/RULES.md) y [plan](docs/ROADMAP.md).

Pendiente: portal PHP/MySQL multiempresa/AdminLTE, usuarios/roles completos, torneos/jornadas, CRUD completo, instalador/actualizador web ZIP con backup/migraciones, exportación de logs, sincronización central, gateway WSS/replay con retención, adaptador APK Signage, descubrimiento mDNS/NSD, QR, apps Android/iOS/Watch, Bluetooth y pruebas de hardware/latencia LAN. El visor web no modifica Digital Signage.
