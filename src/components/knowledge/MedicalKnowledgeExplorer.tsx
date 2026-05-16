import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Share2, Info, ArrowRight } from "lucide-react";

export function MedicalKnowledgeExplorer() {
    const [search, setSearch] = useState("");
    
    const { data: relations } = useQuery({
        queryKey: ["knowledge-graph", search],
        queryFn: async () => {
            if (search.length < 3) return [];
            const { data, error } = await supabase
                .from("medical_knowledge_graph")
                .select("*")
                .or(`source_entity.ilike.%${search}%,target_entity.ilike.%${search}%`)
                .limit(20);
            if (error) throw error;
            return data;
        },
        enabled: search.length >= 3
    });

    return (
        <div className="space-y-6">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
                <Input 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Explorar Knowledge Graph (ex: IAM, Sepse, HAS)..."
                    className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 text-lg font-medium"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {relations?.map((rel) => (
                    <div key={rel.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/40 transition-all group">
                        <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                                {rel.relation_type}
                            </Badge>
                            <span className="text-[10px] font-bold text-white/20">{(rel.strength * 100).toFixed(0)}% STRONG</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-black text-sm text-white truncate max-w-[100px]">{rel.source_entity}</span>
                            <ArrowRight className="h-3 w-3 text-white/20 group-hover:text-primary transition-colors" />
                            <span className="font-black text-sm text-primary truncate max-w-[100px]">{rel.target_entity}</span>
                        </div>
                    </div>
                ))}

                {search.length >= 3 && (!relations || relations.length === 0) && (
                    <div className="col-span-full py-12 text-center border border-dashed border-white/5 rounded-[32px]">
                        <Info className="h-8 w-8 text-white/10 mx-auto mb-3" />
                        <p className="text-sm text-white/40 font-medium italic">Nenhuma relação semântica mapeada para "{search}" ainda.</p>
                    </div>
                )}
            </div>

            <div className="p-6 rounded-[32px] bg-gradient-to-br from-primary/10 to-transparent border border-primary/10">
                <div className="flex items-start gap-4">
                    <Share2 className="h-6 w-6 text-primary shrink-0 mt-1" />
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-tighter text-white mb-1">Knowledge-Driven Reasoning</h4>
                        <p className="text-xs text-white/60 leading-relaxed">
                            O Knowledge Graph ENAZIZI mapeia correlações clínicas profundas, sintomas associados e farmacologia, 
                            permitindo que o Tutor e o Planner identifiquem lacunas antes mesmo do aluno errar uma questão.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
