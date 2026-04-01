import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (res.ok && data.valid === true) {
          setStatus("valid");
        } else if (data.reason === "already_unsubscribed") {
          setStatus("already");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };

    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } }
      );
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <MailX className="h-6 w-6 text-primary" />
            Cancelar inscrição
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Validando...</p>
            </div>
          )}

          {status === "valid" && (
            <>
              <p className="text-muted-foreground">
                Deseja deixar de receber e-mails do ScoutFoto?
              </p>
              <Button
                onClick={handleUnsubscribe}
                disabled={processing}
                variant="destructive"
                className="w-full"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirmar cancelamento
              </Button>
            </>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="text-foreground font-medium">
                Inscrição cancelada com sucesso.
              </p>
              <p className="text-sm text-muted-foreground">
                Você não receberá mais e-mails do ScoutFoto.
              </p>
            </div>
          )}

          {status === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
              <p className="text-foreground font-medium">
                Você já cancelou sua inscrição anteriormente.
              </p>
            </div>
          )}

          {status === "invalid" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-foreground font-medium">
                Link inválido ou expirado.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-foreground font-medium">
                Ocorreu um erro. Tente novamente mais tarde.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
