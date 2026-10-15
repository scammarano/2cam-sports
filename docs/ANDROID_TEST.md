# 2Cam Sports Control · APK 0.2.0 de prueba

Esta APK se instala en tablet o teléfono **Android 6.0 o superior**. Es el control nativo; no es la aplicación del Fire Stick, no sustituye el servicio local y todavía no integra Digital Signage. No sirve para iPad/iPhone.

## Instalar y enlazar

1. En GitHub Actions, ejecución aprobada de **Build Android control APK**, descargar el artifact **2cam-sports-control-0.2.0-test-APK**. Descomprimir y pasar `2cam-sports-control-0.2.0-test.apk` a la tablet.
2. Abrir el APK y permitir la instalación desde la aplicación que lo abre si Android lo solicita. Es una compilación de prueba firmada con clave debug, no una publicación de Play Store.
3. Mantener el servicio Sports 0.1.0 ejecutándose en la computadora. No requiere actualizar ese ZIP para esta APK. Iniciar con `SPORTS_HOST=0.0.0.0`, no solo localhost, y permitir el puerto 8787 en el firewall de red privada.
4. Conectar tablet y computadora a la misma red. En Windows, `ipconfig` muestra la dirección IPv4 del adaptador conectado al Wi-Fi/LAN. No usar 127.0.0.1 en la tablet: esa dirección sería la propia tablet.
5. Abrir **2Cam Sports Control** e introducir, por ejemplo, `http://192.168.1.20:8787` (usar la IP real de tu computadora). Pulsar **Buscar pantallas Sports**.
6. Desde la administración web del servicio crear pista, encuentro y pantalla de prueba; iniciar encuentro. Abrir el visor en otra pantalla/navegador.
7. En administración elegir el rol (oficial, auxiliar A o auxiliar B) y **Abrir enlace**. En la APK elegir la pantalla y escribir el nombre del dispositivo y el código de seis dígitos. El código vence en dos minutos.
8. Sumar puntos. El oficial también puede deshacer con confirmación. Cada pantalla admite tres controles persistentes; el administrador libera cupos mediante Desvincular.

No pide contraseña de administrador en la tablet; el código otorga el rol que el administrador eligió. Conserva el token de enlace cifrado con AES-GCM y clave de AndroidKeyStore, con backup deshabilitado. Al volver a abrir intenta reconectar.

La APK debug admite HTTP únicamente a IP privadas/loopback o nombres `.local` para este laboratorio. No admite credenciales, parámetros ni rutas arbitrarias en la dirección. Para uso real se necesita HTTPS confiable; no se desactiva la validación de certificados.

## Pruebas en tu tablet

- Comprobar puntos de A y B y deshacer un punto; revisar simultáneamente el visor.
- Cerrar y volver a abrir la APK: conserva enlace y marcador confirmado por servidor.
- Quitar el Wi-Fi: queda el último marcador, aviso desconectado y botones deshabilitados. Reconectar y revisar recuperación.
- Si se pierde una respuesta de un punto: **Verificar operación pendiente** reutiliza su identificador. No sumes el punto de nuevo con otro comando hasta resolverlo.
- Probar roles auxiliares: no deben corregir ni sumar al lado contrario.
- Revocar el control en administración: la APK debe indicar acceso revocado. Para cambiar de pantalla, olvidar el enlace local y liberar el cupo desde administración.

Una pulsación concurrente puede devolver conflicto de versión: se actualiza el marcador y se debe revisar antes de repetir. No se suman puntos en modo desconectado.

## Límites de esta entrega

El botón Buscar consulta el catálogo de pantallas del servidor introducido; aún no escanea automáticamente todos los servicios de la LAN. No hay QR, Bluetooth, Watch, configuración completa del encuentro desde APK ni APK de pantalla Sports integrada en Signage. No hay servicio local alojado dentro del Fire Stick. No se anuncia latencia de hardware sin pruebas físicas.

El workflow ejecuta compilación, lint y pruebas de integración en emulador Android API29. La compatibilidad declarada empieza en API23, pero no implica pruebas en todas las tablets. Reporta modelo y versión Android al probar.

La firma debug se conserva en cache de Actions cuando está disponible. Si cambia o la cache se pierde, Android puede rechazar la actualización: desinstalar la APK anterior y enlazar de nuevo; liberar el cupo viejo desde administración. La firma definitiva de distribución queda pendiente.

## Compilar desde fuentes

JDK17, Android SDK35 y Gradle8.11.1. En `android/`, ejecutar `gradle :app:assembleDebug :app:lintDebug`. El workflow instala las herramientas y genera APK+SHA256+esta guía; no es necesario compilar en la tablet ni instalar Node en ella.
