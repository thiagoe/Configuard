/**
 * Dialog that warns user about impending logout due to inactivity
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface InactivityWarningDialogProps {
  open: boolean;
  remainingSeconds: number;
  onContinue: () => void;
}

export function InactivityWarningDialog({
  open,
  remainingSeconds,
  onContinue,
}: InactivityWarningDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Sessão Expirando
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Sua sessão será encerrada automaticamente devido à inatividade.
            </p>
            <div className="flex items-center justify-center py-4">
              <div className="text-4xl font-bold text-warning tabular-nums">
                {remainingSeconds}
              </div>
              <span className="ml-2 text-muted-foreground">segundos</span>
            </div>
            <p className="text-center">
              Clique no botão abaixo para continuar logado.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onContinue}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Continuar Logado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default InactivityWarningDialog;
