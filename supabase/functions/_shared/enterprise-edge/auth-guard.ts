/**
 * ENAZIZI ENTERPRISE — Auth Guard
 * Unified authentication and authorization.
 */

import { createClient, User } from "npm:@supabase/supabase-js@2.45.0";

export interface AuthResult {
  user: User;
  isAdmin: boolean;
  supabaseAdmin: any;
}

export async function requireAuth(req: Request): Promise<AuthResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("UNAUTHORIZED: Missing authorization header");

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) throw new Error("UNAUTHORIZED: Invalid or expired token");

  // Check admin status
  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  return {
    user,
    isAdmin: !!roleData,
    supabaseAdmin,
  };
}

export async function requireAdmin(req: Request): Promise<AuthResult> {
  const result = await requireAuth(req);
  if (!result.isAdmin) throw new Error("FORBIDDEN: Admin privileges required");
  return result;
}
