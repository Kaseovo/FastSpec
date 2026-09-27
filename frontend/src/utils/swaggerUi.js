// Swagger UI for the preview, bundled with the app (no CDN, so it works
// offline and makes no third-party requests) and loaded only when a preview
// is first shown — it's large.
let loading = null;

export function loadSwaggerUI() {
  loading ??= Promise.all([
    import("swagger-ui-dist/swagger-ui-bundle.js"),
    import("swagger-ui-dist/swagger-ui-standalone-preset.js"),
    import("swagger-ui-dist/swagger-ui.css"),
  ])
    .then(([bundle, preset]) => ({
      SwaggerUIBundle: bundle.default ?? bundle,
      SwaggerUIStandalonePreset: preset.default ?? preset,
    }))
    .catch((error) => {
      loading = null; // let a later preview retry
      throw error;
    });
  return loading;
}
