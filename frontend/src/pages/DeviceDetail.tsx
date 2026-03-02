import { useParams, useNavigate } from "react-router-dom";
import { useDevice } from "@/hooks/useDevices";
import { useCredentials } from "@/hooks/useCredentials";
import { useTemplates } from "@/hooks/useTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Server, Network, FileCode, Archive, Calendar, Info } from "lucide-react";
import { format } from "date-fns";

const DeviceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: device, isLoading: deviceLoading } = useDevice(id);
  const { data: credentials = [] } = useCredentials();
  const { data: templates = [] } = useTemplates();

  // Find the credential and template names
  const credential = credentials.find(c => c.id === device?.credential_id);
  const template = templates.find(t => t.id === device?.backup_template_id);

  if (deviceLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          Carregando informações do dispositivo...
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-destructive">Dispositivo não encontrado</p>
          <Button onClick={() => navigate("/devices")} className="mt-4">
            Voltar para Dispositivos
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-accent/20 text-accent border-accent/30";
      case "inactive":
        return "bg-muted text-muted-foreground border-border";
      case "maintenance":
        return "bg-warning/20 text-warning border-warning/30";
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getBackupStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
        return "bg-accent/20 text-accent border-accent/30";
      case "failed":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "running":
        return "bg-primary/20 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/devices")}
              className="border-border"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center space-x-3">
              <Server className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-3xl font-bold">{device.name}</h2>
                <p className="text-muted-foreground font-mono">{device.ip_address}</p>
              </div>
            </div>
          </div>
          <Badge className={getStatusBadge(device.status)}>
            {device.status}
          </Badge>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informações Básicas */}
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{device.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Endereço IP</p>
                  <p className="font-medium font-mono">{device.ip_address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hostname</p>
                  <p className="font-medium">{device.hostname || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Porta</p>
                  <p className="font-medium font-mono">{device.port}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusBadge(device.status)}>
                    {device.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Backup Habilitado</p>
                  <Badge className={device.backup_enabled ? "bg-accent/20 text-accent border-accent/30" : "bg-muted text-muted-foreground border-border"}>
                    {device.backup_enabled ? "Sim" : "Não"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classificação */}
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Classificação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Marca</p>
                  <p className="font-medium">{device.brand?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <p className="font-medium">{device.category?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modelo</p>
                  <p className="font-medium">{device.model?.name || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Backup */}
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Configuração de Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Credencial</p>
                  <p className="font-medium">{credential?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Template de Backup</p>
                  <p className="font-medium">{template?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retenção Personalizada</p>
                  <Badge className={device.custom_retention ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}>
                    {device.custom_retention ? "Sim" : "Não (Global)"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Versões Retidas</p>
                  <p className="font-medium">{device.retention_versions || "Global"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status do Último Backup */}
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                Último Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">
                    {device.last_backup_at
                      ? format(new Date(device.last_backup_at), "dd/MM/yyyy HH:mm:ss")
                      : "Nunca"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {device.last_backup_status ? (
                    <Badge className={getBackupStatusBadge(device.last_backup_status)}>
                      {device.last_backup_status}
                    </Badge>
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </div>
                {device.last_backup_error && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Erro</p>
                    <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md mt-1">
                      {device.last_backup_error}
                    </p>
                  </div>
                )}
                {device.last_config_hash && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Hash da Última Configuração</p>
                    <p className="font-mono text-xs bg-muted p-2 rounded-md mt-1 break-all">
                      {device.last_config_hash}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Registro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(new Date(device.created_at), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Atualizado em</p>
                  <p className="font-medium">
                    {format(new Date(device.updated_at), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Observações */}
        {device.notes && (
          <Card className="border-border bg-card shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap">{device.notes}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DeviceDetail;
