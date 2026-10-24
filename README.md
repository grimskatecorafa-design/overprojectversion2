# Over Project V2

Sitio estático de Over Project (overproject.com.mx · overprojectversion2.vercel.app). Vercel publica solo cada cambio en `main`.

- **Editar textos, servicios, planes, pilares, portafolio y teléfono:** entra a `https://www.overproject.com.mx/#editor`
  (o "Acceso editor" en el pie de página) con el correo y contraseña de tu editor de Over Project.
  Los cambios se guardan en Firebase (documento `content/siteV2`).
- **Videos de portada:** `videos/`. **Logo:** `img/logo.png`. **Modelo 3D:** `models/hoodie.glb`.
- Este repo contiene el sitio ya compilado (`assets/`); el código fuente vive aparte.

## El editor también guarda en Vercel

Cada vez que le das **Publicar cambios** en el editor:

1. El contenido se guarda en Firebase (`content/siteV2`), como siempre.
2. Un script en `index.html` llama a `api/publish` (función de Vercel).
3. La función verifica tu sesión de editor, lee lo publicado en Firebase y lo guarda en este repo como
   **`content/siteV2.json`**. Ese commit hace que Vercel vuelva a publicar.

Así este repo siempre tiene los textos reales del sitio, y su historial de commits sirve como respaldo de cada edición.

Configuración en Vercel (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | Token de GitHub (fine-grained) con acceso solo a este repo y permiso **Contents: Read and write**. Obligatoria. |
| `ALLOWED_EDITORS` | Opcional. Correos que pueden sincronizar, separados por coma (ej. `overproject@gmail.com`). |

## Reglas para futuras actualizaciones del código (importante)

Para que una versión nueva **no borre lo editado desde la página**:

- **`content/siteV2.json` es el contenido real del sitio.** Al recompilar, usa ese archivo como los textos por defecto
  (el objeto de contenido por defecto del código) en lugar de los textos originales.
- **No cambies el documento de Firebase** (`content/siteV2`) ni renombres las llaves del contenido. Si una sección cambia
  de estructura, migra los valores guardados en lugar de empezar de cero.
- **Conserva** el `<script>` de sincronización en `index.html`, la carpeta `api/` y la carpeta `content/`.
- No modifiques `content/siteV2.json` a mano: lo escribe el editor.
