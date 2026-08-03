import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, RefreshCw, ExternalLink, Info } from 'lucide-react';

const REPO_URL = 'https://github.com/izolprojetos-design/scoutfoto';
const APP_INSTALL_URL = 'https://github.com/apps/lovable/installations/new';
const APP_SETTINGS_URL = 'https://github.com/settings/installations';

const STEPS = [
  'Clique em "Reconectar no GitHub" abaixo (abre em nova aba).',
  'Faça login na conta que é dona do repositório scoutfoto.',
  'Autorize o Lovable e, em "Repository access", marque o repositório scoutfoto.',
  'Salve. Volte ao editor Lovable e confirme que o aviso "GitHub connection lost" desapareceu.',
];

export function GitHubReconnectCard() {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold">
          <Github className="h-5 w-5 text-primary" /> Conexão com o GitHub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Quando o acesso ao repositório expira ou é revogado, a sincronização do código para
          o GitHub para de funcionar. Use o atalho abaixo para reconectar em menos de um minuto.
        </p>

        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="gap-2">
            <a href={APP_INSTALL_URL} target="_blank" rel="noopener noreferrer">
              <RefreshCw className="h-4 w-4" /> Reconectar no GitHub
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={APP_SETTINGS_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Gerenciar permissões
            </a>
          </Button>
          <Button asChild variant="ghost" className="gap-2">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" /> Abrir repositório
            </a>
          </Button>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enquanto a conexão estiver perdida, o que você editar no Lovable não é enviado ao
            GitHub (e vice-versa). Reconecte antes de continuar editando para evitar perda de código.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default GitHubReconnectCard;
