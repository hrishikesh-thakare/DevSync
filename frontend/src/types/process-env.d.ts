/**
 * A handful of vendored `src/components/reui/**` files (installed via the
 * shadcn CLI from the reui registry) check `process.env.NODE_ENV` for dev-only
 * warnings, following the common React-ecosystem convention — but this is a
 * pure Vite/browser app with no `@types/node`, so `process` is otherwise
 * unknown to TypeScript. Pulling in `@types/node` would type-check against
 * the wrong runtime (Buffer, require, fs, …); this declares only the one
 * property those files actually read.
 */
declare const process: {
  env: {
    NODE_ENV?: string;
  };
};
