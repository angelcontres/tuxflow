import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/**
 * Configuración de ESLint en formato plano (flat config), para ESLint 10.
 *
 * Decisión de alcance: este es un linter de *corrección*, no de estilo.
 * Todo lo que sea formato (sangrado, comas, comillas, ancho de línea) lo decide
 * Prettier. Por eso `eslint-config-prettier` va AL FINAL del array y apaga las
 * reglas de estilo de ESLint: sin eso, los dos Formatters se pelean y cada
 * Formatter deshace lo del otro.
 *
 * El chequeo de tipos ya lo hace `tsc` dentro de `pnpm run build`, así que
 * `tseslint.configs.recommended` se usa sin el parser con tipos. Duplicar el
 * chequeo de tipos en el linter sólo agrega tiempo de ejecución.
 */
export default tseslint.config(
  {
    // Se ignoran artefactos generados, no código fuente.
    ignores: ['dist', 'coverage', 'node_modules', '*.config.js', '*.config.ts'],
  },

  // Reglas base de JavaScript.
  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Las dos reglas esenciales de React, y sólo esas.
      //
      // `react-hooks@7` incluye un `recommended-latest` que activa 17 reglas,
      // casi todas del React Compiler (purity, immutability, use-memo,
      // set-state-in-render...). Se dejan desactivadas a propósito: este
      // proyecto no usa el React Compiler y adoptarlas ahora produciría ruido
      // en código que funciona. Se pueden encender más adelante si el proyecto
      // migra al compilador.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // `public/sw.js` corre en el contexto de un service worker, no del navegador.
  // Sin esto, `self`, `clients` y `caches` aparecen como no definidos. Se declara
  // el contexto correcto en vez de excluir el archivo, para que siga analizándose.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },

  // Debe ir último: desactiva toda regla de estilo que choque con Prettier.
  prettier,
);
