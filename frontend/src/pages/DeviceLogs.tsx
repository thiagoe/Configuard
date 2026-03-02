import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useDevice } from "@/hooks/useDevices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, AlertTriangle, Play, Square } from "lucide-react";
import { format } from "date-fns";
import { getAccessToken } from "@/services/api";

const DeviceLogs = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: device, isLoading: deviceLoading } = useDevice(id);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [logLevel, setLogLevel] = useState<"info" | "verbose" | "debug">("info");
  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamLogs]);

  const startStream = () => {
    if (!id) return;
    const token = getAccessToken();
    if (!token) {
      setStreamLogs((prev) => [...prev, "Token ausente. Faça login novamente."]);
      return;
    }

    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
    const url = `${baseUrl}/devices/${id}/backup/stream?token=${encodeURIComponent(token)}&log_level=${logLevel}`;

    setStreamLogs([]);
    setStreaming(true);

    const es = new EventSource(url);
    eventSourceRef.current = es;

    const appendLog = (label: string, message?: string) => {
      const line = message ? `[${label}] ${message}` : `[${label}]`;
      setStreamLogs((prev) => [...prev, line]);
    };

    es.onopen = () => appendLog("open", "Conexão SSE aberta");
    es.onerror = () => {
      appendLog("error", "Erro na conexão SSE");
      es.close();
      setStreaming(false);
    };

    // Remove ANSI escape codes from text
    const stripAnsi = (text: string) => {
      return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    };

    const handler = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        const { message, chunk, ...rest } = payload || {};
        // Strip ANSI codes from message and chunk
        const base = stripAnsi(message || chunk || "");
        const extra = Object.keys(rest || {}).length ? JSON.stringify(rest) : "";
        const full = base && extra ? `${base} ${extra}` : base || extra;

        // For output events with multiple lines, split them for better readability
        if (event.type === "output" && full.includes("\n")) {
          const lines = full.split("\n");
          // Add first line with label
          if (lines[0]) {
            appendLog(event.type, lines[0]);
          }
          // Add remaining lines without label (continuation)
          for (let i = 1; i < lines.length; i++) {
            if (lines[i]) {
              setStreamLogs((prev) => [...prev, `       ${lines[i]}`]);
            }
          }
        } else {
          appendLog(event.type, full);
        }
      } catch {
        appendLog(event.type, stripAnsi(event.data || ""));
      }
      if (event.type === "done" || event.type === "error") {
        es.close();
        setStreaming(false);
      }
    };

    es.addEventListener("status", handler);
    es.addEventListener("command", handler);
    es.addEventListener("output", handler);
    es.addEventListener("verbose", handler);
    es.addEventListener("debug", handler);
    es.addEventListener("error", handler);
    es.addEventListener("done", handler);
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
    setStreamLogs((prev) => [...prev, "[close] Conexão SSE encerrada"]);
  };

  if (deviceLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          Carregando logs do dispositivo...
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
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/devices")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-3xl font-bold">{device.name}</h2>
            <p className="text-muted-foreground">{device.ip_address}</p>
          </div>
        </div>

        <Card className="border-border bg-card shadow-[var(--shadow-card)]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Último Backup
              </span>
              <Badge variant={device.last_backup_status === "success" ? "outline" : "destructive"}>
                {device.last_backup_status || "unknown"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {device.last_backup_at
                  ? format(new Date(device.last_backup_at), "dd/MM/yyyy HH:mm:ss")
                  : "sem execução"}
              </span>
              {device.last_backup_error && (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {device.last_backup_error}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs em Tempo Real
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Nível</span>
                  <Select value={logLevel} onValueChange={(value) => setLogLevel(value as "info" | "verbose" | "debug")} disabled={streaming}>
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="verbose">Verbose</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={startStream} disabled={streaming}>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Backup
                </Button>
                <Button size="sm" variant="outline" onClick={stopStream} disabled={!streaming}>
                  <Square className="h-4 w-4 mr-2" />
                  Parar
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-black text-green-300 font-mono text-xs p-3 overflow-auto resize-y min-h-64 h-[60vh]">
              {streamLogs.length === 0 ? (
                <div className="text-muted-foreground">Sem logs ainda. Clique em iniciar backup.</div>
              ) : (
                streamLogs.map((line, idx) => {
                  let className = "whitespace-pre-wrap break-all";
                  if (line.includes("Login") && line.includes("sucesso") || line.includes("realizado com sucesso")) {
                    className += " text-emerald-400 font-semibold";
                  } else if (line.includes("Falha no login") || line.includes("falhou") || line.includes("login_failed")) {
                    className += " text-red-400 font-semibold";
                  } else if (line.startsWith("[error]")) {
                    className += " text-red-400";
                  } else if (line.startsWith("[done]")) {
                    className += " text-blue-400 font-semibold";
                  }
                  return <div key={idx} className={className}>{line}</div>;
                })
              )}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default DeviceLogs;
