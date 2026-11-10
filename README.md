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

## Tema blanco y negro + fondo de onda de partículas

La capa visual vive en archivos aparte y no toca el editor ni el contenido:

- `assets/bw-theme.v2.css` — paleta blanco/negro/grises con acento azul fuerte (#1F3BFF: botones, palabras resaltadas, menú, plan destacado, brillos) sobre `app-LZJXYSQA.css` (misma tipografía: Anton + Space Grotesk). Reemplaza los colores por sección (morado, cian, lima, magenta), pone el logo y la intro en blanco y el video de "Sobre nosotros" en escala de grises.
- `assets/bw-wave.v2.js` — fondo dinámico: cinta de hilos de partículas (capa trasera y parte de la nube en azul) que ondula y se cruza, con polvo flotante. Se pausa con la pestaña oculta y respeta "reducir movimiento".
- `assets/app-JGNQMROS-bw5.js` es el mismo bundle con estos cambios: si el teléfono de Contacto trae varios números (por ejemplo "33 27 94 39 05 / 33 45 36 38 32"), cada uno se puede tocar para llamar y tiene su propio par de botones WhatsApp / Llamar (estilos en `assets/bw-contacto.v1.css`); el formulario usa el primer número. Además: los planes son servicios de pago único (sin "/ mes"; política de reembolsos adaptada); el fondo de estrellas anterior ya no se anima (además se oculta con CSS) y el video de "Sobre nosotros" es `videos/about-nosotros.mp4` (horizontal).
- `assets/bw-about.v1.css` — recuadro horizontal (16:9) para ese video, en computadora y celular.
- `assets/bw-plans.v1.css` — Planes: 3 mensuales arriba y los 2 planes web abajo, mitad y mitad (como el sitio oficial).
- `assets/bw-ajustes.v3.css` — ajustes pequeños: fondo de onda detrás de todo, logo de la portada más pequeño y sin la sección "Pilares" en Servicios.

Si cambias estos archivos, súbele la versión al nombre (`.v2`) y actualiza `index.html`: `/assets/` se guarda en caché un año.

## Asistente de chat (IA gratis + botones guiados)

- `assets/op-chat.v12.js` + `assets/op-chat.v3.css` — botón flotante "¿Dudas? Pregúntame" y panel de chat.
  - **Botones guiados (sin IA, sin costo):** "¿Qué paquete me conviene?", "Ver precios", "Quiero una página web", "Servicios sueltos". Toman planes, servicios y precios del editor (Firebase `content/siteV2`), así que se actualizan solos.
  - **Preguntas libres:** van a `api/chat`. Hasta 25 preguntas por visita (se mandan solo los últimos 12 mensajes para cuidar el cupo); después pasa a WhatsApp.
  - **Cotizar página web:** "quiero una página web" (o el botón) abre una entrevista: tipo (informativa, tienda o sistema de reservas), negocio, tamaño, funciones, logo, dominio y fecha; al final muestra la cotización y la manda por WhatsApp.
  - **"¿Dónde está…?":** la IA conoce el mapa de la página y el chat muestra botones "Ir a …" a la sección. Si piden ejemplos, ofrece "Creaciones" (páginas web) y "Portafolio".
  - **WhatsApp:** abre el número de Contacto (editor) con un resumen de lo que platicó el cliente.
- `api/chat.js` — función de Vercel. Manda al modelo solo la información relevante (≈800 tokens por pregunta) para rendir el plan gratis.
  - Motor: **Cloudflare Workers AI** (`@cf/meta/llama-3.1-8b-instruct-fp8-fast`), plan gratis de 10,000 neuronas al día (≈150 conversaciones de 6 preguntas).
  - Respaldo opcional: **Google Gemini** (plan gratis). Si los dos fallan, el chat manda a WhatsApp sin mostrar error.

Variables en Vercel (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `CF_ACCOUNT_ID` | ID de la cuenta de Cloudflare (Workers AI). Obligatoria. |
| `CF_API_TOKEN` | Token de Cloudflare con permiso **Workers AI**. Obligatoria. |
| `GEMINI_API_KEY` | Opcional: clave de Google AI Studio para el respaldo. |

Estado: Cloudflare conectado (noviembre 2026).
