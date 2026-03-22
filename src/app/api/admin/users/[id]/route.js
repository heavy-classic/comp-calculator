import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return null;
  }
  return user;
}

// PATCH /api/admin/users/[id] — update role or password
export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates = {};

  if (body.role !== undefined) {
    updates.app_metadata = { role: body.role };
  }
  if (body.password) {
    updates.password = body.password;
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updates);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email,
    role: data.user.app_metadata?.role || 'user',
  });
}

// DELETE /api/admin/users/[id] — remove a user
export async function DELETE(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  const supabase = await createSupabaseServerClient();
  const { data: { user: self } } = await supabase.auth.getUser();
  if (self.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
