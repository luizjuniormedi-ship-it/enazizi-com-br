-- AUDIT & FIX RLS FOR CORE TABLES

-- 1. PROFILES (Security fix: Ensure users can only update their own profile)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 2. ERROR BANK (Critical for student data privacy)
ALTER TABLE public.error_bank ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own error bank" ON public.error_bank;
    CREATE POLICY "Users can view own error bank" ON public.error_bank FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can manage own error bank" ON public.error_bank;
    CREATE POLICY "Users can manage own error bank" ON public.error_bank FOR ALL USING (auth.uid() = user_id);
END $$;

-- 3. FLASHCARDS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
    CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT USING (auth.uid() = user_id OR is_global = true);

    DROP POLICY IF EXISTS "Users can manage own flashcards" ON public.flashcards;
    CREATE POLICY "Users can manage own flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id);
END $$;

-- 4. FSRS CARDS (Spaced Repetition)
ALTER TABLE public.fsrs_cards ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own fsrs cards" ON public.fsrs_cards;
    CREATE POLICY "Users can view own fsrs cards" ON public.fsrs_cards FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can manage own fsrs cards" ON public.fsrs_cards;
    CREATE POLICY "Users can manage own fsrs cards" ON public.fsrs_cards FOR ALL USING (auth.uid() = user_id);
END $$;

-- 5. USER ROLES (Critical for security)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
    CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
END $$;
