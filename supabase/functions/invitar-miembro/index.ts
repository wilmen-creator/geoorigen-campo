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
// POST { accion: 'primer_admin', org_id, nombre, email?, usuario?, password? }
//   - Solo GeoOrigen (administrador de la plataforma) y solo si la organización aún no
//     tiene administrador: crea al primer admin de una asociación nueva.
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

  const primerAdmin = body.accion === 'primer_admin';
  if (primerAdmin) {
    // GeoOrigen (administrador de la plataforma) crea SOLO el primer administrador de una
    // organización nueva; desde ahí la asociación maneja su equipo. GeoOrigen no se puede
    // nombrar a sí mismo: para ver datos de una asociación existe el acceso de emergencia.
    const { data: plataforma } = await admin.from('plataforma_admins').select('user_id').eq('user_id', quien.user.id).maybeSingle();
    if (!plataforma) return respuesta({ error: 'Solo el administrador de la plataforma puede hacer esto' }, 403);
    const { count: admins } = await admin.from('miembros').select('user_id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('rol', 'admin').eq('activo', true).is('expira_en', null);
    if ((admins ?? 0) > 0) {
      return respuesta({ error: 'Esta organización ya tiene administrador: él gestiona su equipo desde el panel' }, 409);
    }
    body.accion = 'invitar';
    body.rol = 'admin';
  } else {
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

  // Licencia y cupo del plan: se revisan ANTES de crear la cuenta (la base también los exige)
  const { data: org } = await admin.from('organizaciones').select('activa, licencia_vence, max_usuarios').eq('id', orgId).single();
  const hoy = new Date().toISOString().slice(0, 10);
  if (!org || !org.activa || (org.licencia_vence && org.licencia_vence < hoy)) {
    return respuesta({ error: 'La licencia de esta organización está vencida o suspendida. Contacta a GeoOrigen para renovarla.' }, 403);
  }
  if (org.max_usuarios != null) {
    const { data: activos } = await admin.from('miembros').select('user_id')
      .eq('org_id', orgId).eq('activo', true).is('expira_en', null);
    const { data: existente } = await admin.from('perfiles').select('user_id').eq('email', email).maybeSingle();
    const yaEsMiembro = !!existente && (activos ?? []).some((m) => m.user_id === existente.user_id);
    if (!yaEsMiembro && (activos ?? []).length >= org.max_usuarios) {
      return respuesta({ error: `El plan de esta organización permite ${org.max_usuarios} usuario(s). Para agregar más, contacta a GeoOrigen.` }, 409);
    }
  }

  // ¿Ya tiene cuenta? (los perfiles se crean solos con cada usuario)
  const { data: perfil } = await admin.from('perfiles').select('user_id').eq('email', email).maybeSingle();
  let userId = perfil?.user_id as string | undefined;
  let invitado = false;

  if (primerAdmin && userId) {
    const { data: esPlataforma } = await admin.from('plataforma_admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (esPlataforma) {
      return respuesta({ error: 'El administrador de la asociación debe ser una persona de la asociación, no de GeoOrigen' }, 400);
    }
  }

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
