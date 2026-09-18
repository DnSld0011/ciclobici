import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Esta app hace fetch-on-mount + suscripción realtime en componentes
      // cliente (sin SWR/React Query ni loaders de servidor) — el patrón
      // `useEffect(() => { cargar() }, [])` es correcto para esta arquitectura.
      // Se deja como warning en vez de error para no forzar un refactor
      // cosmético sin beneficio funcional real en ~26 archivos.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
