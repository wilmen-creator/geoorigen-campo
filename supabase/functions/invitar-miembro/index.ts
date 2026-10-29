// GeoOrigen Campo — Edge Function: invitar-miembro
//
// Agrega personas a una organización. Solo la puede usar un ADMIN activo de esa
// organización (se comprueba aquí, con la llave de servicio que nunca sale del servidor).
//
// POST { accion: 'invitar', org_id, rol, nombre, email?, usuario?, password? }
//   - Con email y sin password  → se envía invitación por correo.
//   - Con email y password      → se crea la cuenta con esa contraseña.
//   - Sin email (usuario)       → cuenta "sin correo": usuario@sin-correo.geoorigen.com,
//                                 la contraseña la fija y la cambia el admin.
//   - Si la persona ya tiene cuenta, solo se agrega a la organización.
// POST { accion: 'cambiar_clave', org_id, user_id, password }
//   - El admin cambia la contraseña de alguien que pertenece SOLO a su organización.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ROLES = ['admin', 'editor', 'colaborador', 'lector'];
const DOMINIO_SIN_CORREO = 'sin-correo.geoorigen.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-usuario-jwt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Prefiere la llave secreta nueva (sb_secret_…); la service_role antigua deja de
// servir si se desactivan las llaves "legacy" del proyecto.
function llaveServicio(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (nuevas.default) return nuevas.default;
  } catch { /* sin llaves nuevas */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, llaveServicio(), {
    auth: { persistSession: false },
  });

  // ¿Quién llama?
  const jwt = req.headers.get('x-usuario-jwt') || (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien, error: errQuien } = await admin.auth.getUser(jwt);
  if (errQuien || !quien.user) {
    console.error('getUser falló:', errQuien?.message);
    return respuesta({ error: `Sesión no válida (${errQuien?.message ?? 'sin usuario'})` }, 401);
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return respuesta({ error: 'JSON inválido' }, 400);
  }
  const orgId = body.org_id;
  if (!orgId) return respuesta({ error: 'Falta org_id' }, 400);

  // ¿Es admin activo (y no de emergencia, que es solo lectura) de esa organización?
  const { data: yo } = await admin
    .from('miembros')
    .select('rol, activo, expira_en')
    .eq('org_id', orgId)
    .eq('user_id', quien.user.id)
    .maybeSingle();
  if (!yo || yo.rol !== 'admin' || !yo.activo || yo.expira_en) {
    return respuesta({ error: 'Solo un administrador de la organización puede hacer esto' }, 403);
  }

  // ── Cambiar contraseña de un miembro ────────────────────────────────────────
  if (body.accion === 'cambiar_clave') {
    if (!body.user_id || (body.password ?? '').length < 8) {
      return respuesta({ error: 'Falta el usuario o la contraseña tiene menos de 8 caracteres' }, 400);
    }
    const { data: miembro } = await admin
      .from('miembros').select('user_id').eq('org_id', orgId).eq('user_id', body.user_id).maybeSingle();
    if (!miembro) return respuesta({ error: 'Esa persona no es de tu organización' }, 404);

    // Si la persona también está en otra organización (o administra la plataforma),
    // cambiarle la clave daría acceso a datos ajenos: debe cambiarla ella misma.
    const { count: otras } = await admin
      .from('miembros').select('org_id', { count: 'exact', head: true })
      .eq('user_id', body.user_id).neq('org_id', orgId);
    const { data: esPlataforma } = await admin
      .from('plataforma_admins').select('user_id').eq('user_id', body.user_id).maybeSingle();
    if ((otras ?? 0) > 0 || esPlataforma) {
      return respuesta({ error: 'Esta persona pertenece a otras organizaciones; debe cambiar su contraseña ella misma' }, 403);
    }

    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
    if (error) return respuesta({ error: error.message }, 400);
    return respuesta({ ok: true });
  }

  // ── Invitar ─────────────────────────────────────────────────────────────────
  if (body.accion !== 'invitar') return respuesta({ error: 'Acción desconocida' }, 400);

  const rol = body.rol;
  const nombre = (body.nombre ?? '').trim();
  if (!ROLES.includes(rol)) return respuesta({ error: 'Rol no válido' }, 400);
  if (!nombre) return respuesta({ error: 'Falta el nombre' }, 400);

  let email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email) {
    const usuario = (body.usuario ?? '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,40}$/.test(usuario)) {
      return respuesta({ error: 'Usuario no válido (letras, números, punto o guion; mínimo 3)' }, 400);
    }
    if (password.length < 8) return respuesta({ error: 'Una cuenta sin correo necesita contraseña de 8 caracteres o más' }, 400);
    email = `${usuario}@${DOMINIO_SIN_CORREO}`;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respuesta({ error: 'Correo no válido' }, 400);
  } else if (password && password.length < 8) {
    return respuesta({ error: 'La contraseña debe tener 8 caracteres o más' }, 400);
  }

  // ¿Ya tiene cuenta? (los perfiles se crean solos con cada usuario)
  const { data: perfil } = await admin.from('perfiles').select('user_id').eq('email', email).maybeSingle();
  let userId = perfil?.user_id as string | undefined;
  let invitado = false;

  if (!userId) {
    if (password) {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre },
      });
      if (error) return respuesta({ error: error.message }, 400);
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nombre } });
      if (error) return respuesta({ error: error.message }, 400);
      userId = data.user.id;
      invitado = true;
    }
  }

  const { error: errMiembro } = await admin.from('miembros').upsert(
    { org_id: orgId, user_id: userId, rol, activo: true, expira_en: null, motivo: null },
    { onConflict: 'org_id,user_id' },
  );
  if (errMiembro) return respuesta({ error: errMiembro.message }, 400);

  await admin.from('perfiles').update({ nombre }).eq('user_id', userId);

  return respuesta({ ok: true, user_id: userId, email, invitado });
});
