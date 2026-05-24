import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Server, Cloud, Link as LinkIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfigItem {
  key: string;
  value: string;
  description: string;
}

const HostingConfig = () => {
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from('hosting_config')
        .select('*')
        .order('key');
      
      if (!error) {
        setConfig(data as ConfigItem[]);
      }
      setLoading(false);
    };

    fetchConfig();
  }, []);

  const getIcon = (key: string) => {
    switch (key) {
      case 'hosting_provider': return <Cloud className="h-4 w-4 text-primary" />;
      case 'frontend_url': return <Globe className="h-4 w-4 text-primary" />;
      case 'custom_domains': return <LinkIcon className="h-4 w-4 text-primary" />;
      case 'backend_infrastructure': return <Server className="h-4 w-4 text-primary" />;
      case 'email_infrastructure': return <Server className="h-4 w-4 text-primary" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  if (loading) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" /> Infraestrutura & Domínios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.map((item) => (
          <div key={item.key} className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              {getIcon(item.key)}
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {item.key.replace(/_/g, ' ')}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{item.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="pl-6">
              {item.key === 'custom_domains' ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {item.value.split(',').map(d => (
                    <Badge key={d} variant="secondary" className="text-[10px] font-mono py-0 h-5">
                      {d.trim()}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium break-all">{item.value}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default HostingConfig;
