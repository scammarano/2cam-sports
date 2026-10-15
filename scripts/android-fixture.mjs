// Servicio efímero de CI; datos en memoria, sin claves de usuarios.
import { Store } from '../src/store.js';
import { createServer } from '../src/server.js';
const server=createServer(new Store(null,'emulator-test-only-admin-key-123456'));
server.listen(8787,'0.0.0.0',()=>console.log('Android CI fixture ready'));
