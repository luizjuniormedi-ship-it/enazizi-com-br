import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Favoritos() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("user_favorites")
          .select("*, enaflix_content(*)")
          .eq("user_id", user.id);
        
        if (error) throw error;
        setFavorites(data || []);
      } catch (err) {
        console.error("Erro ao carregar favoritos:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-white">Meus Favoritos</h1>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">Você ainda não favoritou nenhum conteúdo.</p>
          <p className="text-white/30 text-sm mt-2">Explore o ENAFLIX e salve seus conteúdos preferidos.</p>
          <Link to="/dashboard/enaflix" className="inline-block mt-4 px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">
            Explorar ENAFLIX
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((fav) => (
            <div key={fav.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <h3 className="font-semibold text-white text-sm">{fav.enaflix_content?.title || "Conteúdo"}</h3>
              <p className="text-white/50 text-xs">{fav.enaflix_content?.specialty || ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
