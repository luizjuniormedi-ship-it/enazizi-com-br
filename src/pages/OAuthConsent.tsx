import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function safeNext(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente na URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = encodeURIComponent(safeNext());
        window.location.href = `/login?next=${next}`;
        return;
      }
      setEmail(sess.session.user.email ?? null);
      const oauth = (supabase.auth as any).oauth as AuthOAuth | undefined;
      if (!oauth?.getAuthorizationDetails) {
        setError("Servidor OAuth não disponível neste ambiente.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message ?? String(error));
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const oauth = (supabase.auth as any).oauth as AuthOAuth;
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message ?? String(error));
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("O servidor de autorização não retornou uma URL de redirecionamento.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "um aplicativo externo";
  const redirectUri = details?.client?.redirect_uri ?? details?.client?.redirect_uris?.[0];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Conectar ao ENAZIZI</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!details && !error && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido de autorização…
            </div>
          )}
          {details && (
            <>
              <p className="text-sm">
                <strong>{clientName}</strong> quer se conectar à sua conta do ENAZIZI e usar as ferramentas do seu tutor
                como você.
              </p>
              {email && (
                <p className="text-xs text-muted-foreground">
                  Você está conectado como <strong>{email}</strong>.
                </p>
              )}
              {redirectUri && (
                <p className="text-xs text-muted-foreground break-all">
                  Após aprovar, você será redirecionado para: <code>{redirectUri}</code>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Isso não ignora as permissões nem as políticas de segurança do ENAZIZI. Você pode revogar a qualquer
                momento.
              </p>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                </Button>
                <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="flex-1">
                  Recusar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
