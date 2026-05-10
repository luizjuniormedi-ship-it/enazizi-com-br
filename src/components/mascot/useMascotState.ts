import { useState, useCallback } from 'react';
import { MascotState, MascotInteraction } from './MascotEngine';
import { supabase } from '@/integrations/supabase/client';

export const useMascotState = () => {
  const [state, setState] = useState<MascotState>('idle');
  const [speech, setSpeech] = useState<string | null>(null);

  const triggerInteraction = useCallback(async (interaction: Omit<MascotInteraction, 'id' | 'timestamp'>) => {
    setState(interaction.state);
    if (interaction.speech) {
      setSpeech(interaction.speech);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('mascot_interactions').insert({
          user_id: user.id,
          interaction_type: interaction.type,
          emotional_state: interaction.state,
          metadata: { speech: interaction.speech }
        });
      }
    } catch (error) {
      console.warn('Failed to persist mascot interaction:', error);
    }

    // Auto-idle after a few seconds if it's not a thinking state
    if (!['thinking', 'teaching', 'focus'].includes(interaction.state)) {
      setTimeout(() => {
        setState('idle');
        setSpeech(null);
      }, 5000);
    }
  }, []);

  return {
    state,
    speech,
    setState,
    setSpeech,
    triggerInteraction
  };
};
