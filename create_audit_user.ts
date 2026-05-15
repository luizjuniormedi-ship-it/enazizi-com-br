
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const email = "audit.agent.2026@gmail.com";
const password = "Password123!";

async function setup() {
  console.log("Creating user...");
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Agent Auditor" }
  });

  if (authError) {
    console.error("Auth error:", authError);
    // If user already exists, we continue to roles
    if (authError.message !== "User already registered") return;
  }

  const userId = authUser?.user?.id || (await supabase.from("profiles").select("user_id").eq("email", email).single()).data?.user_id;

  if (!userId) {
    console.error("Could not find user ID");
    return;
  }

  console.log("Granting roles to", userId);
  const roles = ["admin", "professor", "user"];
  for (const role of roles) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (roleError) console.error("Role error:", role, roleError);
  }

  console.log("Updating profile...");
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ status: "approved", role: "admin" })
    .eq("user_id", userId);
  if (profileError) console.error("Profile error:", profileError);

  console.log("Setup complete for", email);
}

setup();
