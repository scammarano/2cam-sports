# 2Cam Sports Control · APK 0.3.0 de prueba

**Tablet → Fire directamente. No necesita computadora ni Node para jugar.**

1. Instalar Digital Signage 0.4.10 Sports directo en el Fire y Sports Control 0.3.0 en tablet/teléfono Android6 o superior.
2. Conectar ambos a la misma red Wi-Fi/LAN.
3. En el Fire: Configuración local (PIN) → SPORTS LOCAL · tablet directa al Fire (sin PC). También accesible sin vincular el portal, desde la pantalla inicial de emparejamiento → Configuración.
4. En el Fire: Nuevo encuentro → pista, jugadores/parejas, disciplina y reglas. Luego Enlazar control → oficial, auxiliar A o auxiliar B. Código de un uso, válido dos minutos.
5. En la tablet: Buscar Fire TV en Wi-Fi → seleccionar Fire → pantalla Sports → escribir nombre del control y código mostrado.
6. Si la red impide mDNS, escribir la dirección que muestra el Fire, por ejemplo http://192.168.1.30:8989, y pulsar Buscar pantallas en la dirección indicada.
7. Sumar puntos; el oficial puede deshacer con confirmación. El Fire guarda y confirma cada operación.

Hasta tres controles por pantalla; cerrar la tablet no libera cupo. En Fire, Controles / revocar permite liberar enlaces. El token de tablet se conserva cifrado con AndroidKeyStore. Dejar abierta la pantalla Sports del Fire: al salir se cierra su receptor y las tablets muestran desconexión.

## Verificar en tu equipo

Sumar para ambos lados, deshacer y mirar marcador. Cerrar/reabrir tablet y comprobar enlace. Desactivar Wi-Fi: no se permiten nuevos puntos. Volver a conectar. Si una respuesta no llegó, Verificar operación pendiente reutiliza el identificador y evita duplicar. Probar auxiliares: no deben corregir ni sumar al lado contrario.

## Alcance

APK debug de prueba, no tienda. HTTP de laboratorio únicamente a IP privadas, localhost o nombres .local; no desactiva validación de certificados HTTPS. No exponer el puerto a internet. Firma debug conservada mediante cache cuando esté disponible; si cambia, Android puede rechazar una actualización. Revisar respaldos/enlaces antes de desinstalar.

Una pantalla primaria Fire por encuentro. Configuración inicial desde el Fire; configuración completa desde tablet, réplicas, sincronización central Sports, QR, Bluetooth, iOS y Watch pendientes. La pantalla usa medios ya descargados de Signage cuando hay caché; no necesita internet para cada punto.

Cliente probado en emulador API29 con fixture de API; receptor real Fire probado aparte en API22 sin servidor Node. La búsqueda multicast y latencia física deben verificarse en la red del usuario.

Fuentes de control en android/ (JDK17, SDK35, Gradle8.11.1). Autoridad portable separada en native-core/, consumida por Digital Signage como módulo sports-core. El ZIP Node S0 queda como banco técnico opcional y no es requisito de uso.
