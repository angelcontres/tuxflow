import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library solo registra su limpieza automática cuando hay un `afterEach` global.
// Este proyecto usa `globals: false` (imports explícitos desde 'vitest'), así que la
// limpieza hay que registrarla a mano. Sin esto, el DOM se acumula entre pruebas y
// getBy* falla con "múltiples elementos encontrados" a partir del segundo test del archivo.
afterEach(cleanup);

// jsdom no implementa window.scrollTo y lanza una advertencia en consola
window.scrollTo = () => {};
