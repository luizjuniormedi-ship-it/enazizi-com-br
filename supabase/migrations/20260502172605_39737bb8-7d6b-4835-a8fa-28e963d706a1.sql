-- Tabela de Feature Flags para Rollout Controlado
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'disabled', -- disabled, admins_only, beta_users, gradual_rollout, enabled
    gradual_rollout_percentage INTEGER DEFAULT 0, -- 0-100
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Qualquer pessoa autenticada pode ler flags" 
ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas admins podem modificar flags" 
ON public.feature_flags FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir flag da automação ENAFLIX (inicia em admins_only)
INSERT INTO public.feature_flags (name, description, status)
VALUES ('tutor_lesson_automation', 'Automação de geração de aulas baseada no estudo real', 'admins_only')
ON CONFLICT (name) DO NOTHING;

-- Função auxiliar para verificar acesso a feature no DB
CREATE OR REPLACE FUNCTION public.check_feature_access(f_name TEXT, u_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    f_status TEXT;
    f_pct INTEGER;
    u_role TEXT;
    u_is_beta BOOLEAN;
    u_hash INTEGER;
BEGIN
    SELECT status, gradual_rollout_percentage INTO f_status, f_pct
    FROM public.feature_flags WHERE name = f_name;
    
    IF f_status IS NULL OR f_status = 'disabled' THEN RETURN FALSE; END IF;
    IF f_status = 'enabled' THEN RETURN TRUE; END IF;
    
    SELECT role INTO u_role FROM public.profiles WHERE user_id = u_id;
    
    -- Admins sempre têm acesso se status não for disabled
    IF u_role = 'admin' THEN RETURN TRUE; END IF;
    
    IF f_status = 'admins_only' THEN RETURN FALSE; END IF;
    
    -- Verificar se é beta user (podemos usar uma coluna na profiles ou metadado)
    -- Por simplicidade, assumimos que role 'beta' ou 'student' + metadata beta:true
    IF f_status = 'beta_users' THEN
        RETURN u_role = 'beta';
    END IF;
    
    -- Rollout gradual baseado no hash do user_id
    IF f_status = 'gradual_rollout' THEN
        u_hash := abs(('x' || left(u_id::text, 8))::bit(32)::integer) % 100;
        RETURN u_hash < f_pct;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;