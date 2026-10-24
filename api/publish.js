// Vercel Serverless Function: POST /api/publish
//
// La llama el sitio justo después de que el editor publica en Firebase.
// 1. Verifica que quien llama tenga una sesión válida del editor (token de Firebase).
// 2. Lee el contenido publicado directamente de Firestore (content/siteV2).
// 3. Lo guarda en este repo como content/siteV2.json -> eso dispara un deploy en Vercel.
//
// Variables de entorno en Vercel:
//   GITHUB_TOKEN     (obligatoria) token con permiso "Contents: Read and write" sobre este repo
//   GITHUB_REPO      (opcional)    por defecto "grimskatecorafa-design/overprojectversion2"
//   GITHUB_BRANCH    (opcional)    por defecto "main"
//   ALLOWED_EDITORS  (opcional)    correos separados por coma; si se define, solo ellos pueden sincronizar

const FIREBASE_API_KEY = 'AIzaSyByuif3q03PW-M-PvOGTPbt_1Fy3n4dIbs';
const FIREBASE_PROJECT = 'over-project-web';
const CONTENT_DOC = 'content/siteV2';
const FILE_PATH = 'content/siteV2.json';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Usa POST' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'Falta GITHUB_TOKEN en Vercel' });
  }
  const repo = process.env.GITHUB_REPO || 'grimskatecorafa-design/overprojectversion2';
  const branch = process.env.GITHUB_BRANCH || 'main';

  // 1) Verificar la sesión del editor
  const auth = req.headers.authorization || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken) return res.status(401).json({ ok: false, error: 'Sin sesión' });

  let email;
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const data = await r.json();
    email = data && data.users && data.users[0] && data.users[0].email;
    if (!r.ok || !email) throw new Error('token inválido');
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Sesión inválida o vencida' });
  }

  const allowed = (process.env.ALLOWED_EDITORS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email.toLowerCase())) {
    return res.status(403).json({ ok: false, error: 'Este correo no puede sincronizar' });
  }

  // 2) Leer lo que quedó publicado en Firestore (fuente de verdad)
  let pretty;
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${CONTENT_DOC}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const doc = await r.json();
    const raw = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
    if (!r.ok || !raw) throw new Error('sin contenido');
    pretty = JSON.stringify(JSON.parse(raw), null, 2) + '\n';
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'No se pudo leer el contenido de Firebase' });
  }

  // 3) Guardarlo en GitHub (solo si cambió)
  const gh = (path, init = {}) =>
    fetch(`https://api.github.com/repos/${repo}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'overproject-editor-sync',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers || {}),
      },
    });

  try {
    let sha;
    const cur = await gh(`contents/${FILE_PATH}?ref=${encodeURIComponent(branch)}`);
    if (cur.ok) {
      const j = await cur.json();
      sha = j.sha;
      const current = Buffer.from(j.content || '', 'base64').toString('utf8');
      if (current === pretty) return res.status(200).json({ ok: true, changed: false });
    } else if (cur.status !== 404) {
      throw new Error(`GitHub ${cur.status}`);
    }

    const stamp = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const put = await gh(`contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Contenido actualizado desde el editor (${email}, ${stamp})`,
        content: Buffer.from(pretty, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) throw new Error(`GitHub ${put.status}`);
    const out = await put.json();
    return res.status(200).json({ ok: true, changed: true, commit: out.commit && out.commit.sha });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `No se pudo guardar en GitHub (${e.message})` });
  }
};
