# Sports Native Core

Componente portable Java8/API19, independiente de reproducción y UI. RacketRules implementa el contrato del motor JavaScript; LocalSportsHost aporta autoridad, persistencia, códigos de enlace, roles, máximo tres controles, versión e idempotencia.

Digital Signage lo consume como módulo sports-core con las mismas fuentes. Su adaptador aporta AtomicFile, socket LAN y anuncio mDNS. El control no recalcula puntos. Las pruebas de conformidad punto a punto y de host están en el módulo consumidor.

El almacenamiento en Fire es la autoridad de esta fase. No se instala un servidor en computadora; sincronización central y réplicas quedan pendientes.
