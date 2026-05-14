import { forwardRef } from "react";
import { Brain } from "lucide-react";

const Footer = forwardRef<HTMLElement>((_, ref) => (
  <footer ref={ref} className="border-t border-border/50 py-12">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-bold">ENAZIZI</span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
          A Evolução do Estudo Médico
        </p>
      </div>
      
      <div className="flex items-center gap-6">
        <a href="/termos" className="text-xs text-muted-foreground hover:text-primary transition-colors">Termos de Uso</a>
        <a href="/privacidade" className="text-xs text-muted-foreground hover:text-primary transition-colors">Privacidade</a>
        <a href="mailto:contato@enazizi.com.br" className="text-xs text-muted-foreground hover:text-primary transition-colors">Suporte</a>
      </div>

      <p className="text-xs text-muted-foreground">
        © 2026 ENAZIZI. Todos os direitos reservados.
      </p>
    </div>
  </footer>
));

Footer.displayName = "Footer";

export default Footer;
