import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AdaptiveRecommendation } from "@/components/adaptive/AdaptiveRecommendationCard";

export const useAdaptiveEngine = (lessonId?: string) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
  const [shadowMode, setShadowMode] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      const { data } = await supabase
        .from('system_flags')
        .select('flag_key, enabled');
      
      const shadowFlag = data?.find(f => f.flag_key === 'adaptive_shadow_mode');
      if (shadowFlag) setShadowMode(shadowFlag.enabled);
    };

    fetchFlags();
  }, []);

  useEffect(() => {
    if (!user || shadowMode) return;

    // Fetch active recommendations (pending status)
    const fetchRecommendations = async () => {
      const { data, error } = await supabase
        .from('adaptive_interventions')
        .select('*, node:context_node_id(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (data) {
        setRecommendations(data.map(r => ({
          ...r,
          node_name: (r as any).node?.name
        })) as AdaptiveRecommendation[]);
      }
    };

    fetchRecommendations();

    // Subscribe to new interventions
    const channel = supabase
      .channel('adaptive-interventions')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'adaptive_interventions',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newInt = payload.new as any;
        if (newInt.status === 'pending') {
          setRecommendations(prev => [newInt as AdaptiveRecommendation, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, shadowMode]);

  const triggerEvaluation = async (triggerType: string, frictionScore: number, nodeId?: string) => {
    if (!user) return;

    const { data, error } = await supabase.rpc('evaluate_adaptive_intervention', {
      p_user_id: user.id,
      p_trigger_type: triggerType,
      p_node_id: nodeId,
      p_lesson_id: lessonId,
      p_friction_score: frictionScore
    });

    if (error) {
      console.error('Error triggering ACE evaluation:', error);
    } else if (shadowMode) {
      console.log('ACE shadow decision recorded:', data);
    }
  };

  const acceptRecommendation = async (id: string) => {
    const { error } = await supabase
      .from('adaptive_interventions')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (!error) {
      setRecommendations(prev => prev.filter(r => r.id !== id));
      toast.success("Intervenção adaptativa iniciada!");
      // Here you would trigger the actual action based on action_taken/payload
    }
  };

  const ignoreRecommendation = async (id: string) => {
    const { error } = await supabase
      .from('adaptive_interventions')
      .update({ status: 'ignored' })
      .eq('id', id);

    if (!error) {
      setRecommendations(prev => prev.filter(r => r.id !== id));
    }
  };

  return {
    recommendations,
    triggerEvaluation,
    acceptRecommendation,
    ignoreRecommendation,
    shadowMode
  };
};
