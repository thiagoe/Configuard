import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, RefreshCw, Loader2, Eye, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { getAuditLogs, AuditLogEntry } from "@/services/admin";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

interface ChangeDetail {
  field: string;
  old: unknown;
  new: unknown;
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    name: "name",
    description: "description",
    ip_address: "ip_address",
    hostname: "hostname",
    port: "port",
    status: "status",
    backup_enabled: "backup_enabled",
    notes: "notes",
    location: "location",
    serial_number: "serial_number",
    firmware_version: "firmware_version",
    username: "username",
    brand_id: "brand",
    category_id: "category",
    credential_id: "credential",
    backup_template_id: "backup_template",
    connection_type: "connection_type",
    command_timeout: "command_timeout",
    connection_timeout: "connection_timeout",
    prompt_pattern: "prompt_pattern",
    pagination_pattern: "pagination_pattern",
    line_ending: "line_ending",
  };
  return labels[field] || field;
};

const getChanges = (log: AuditLogEntry): ChangeDetail[] => {
  if (log.action === "UPDATE" && log.old_data?.changes) {
    const changes = log.old_data.changes as Record<string, { old: unknown; new: unknown }>;
    return Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => ({
      field,
      old: oldVal,
      new: newVal,
    }));
  }
  return [];
};

const getItemName = (log: AuditLogEntry): string => {
  if (log.action === "CREATE") {
    return (log.new_data?.name as string) || "-";
  }
  if (log.action === "DELETE") {
    return (log.old_data?.name as string) || "-";
  }
  if (log.action === "UPDATE") {
    const nameFromData = (log.new_data?.name || log.old_data?.name) as string | undefined;
    if (nameFromData) return nameFromData;
    const changes = log.old_data?.changes as Record<string, { old: unknown; new: unknown }> | undefined;
    if (changes?.name) return (changes.name.new as string) || (changes.name.old as string) || "-";
    return "-";
  }
  if (log.action === "BACKUP") {
    return (log.new_data?.device_name as string) || "-";
  }
  return "-";
};

const Audit = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const pageSize = 50;
  const { t } = useTranslation("audit");
  const { t: tc } = useTranslation("common");
  const { locale } = useAuth();
  const dateFnsLocale = locale === "pt-BR" ? ptBR : enUS;

  const getDescription = (log: AuditLogEntry): string => {
    const changes = getChanges(log);
    if (log.action === "CREATE") return t("events.created");
    if (log.action === "DELETE") return t("events.deleted");
    if (log.action === "UPDATE") {
      if (changes.length === 1) return t("events.fieldChanged", { field: getFieldLabel(changes[0].field) });
      if (changes.length > 1) return t("events.fieldsChanged", { count: changes.length });
      return t("events.updated");
    }
    if (log.action === "LOGIN") return t("events.login");
    if (log.action === "LOGOUT") return t("events.logout");
    if (log.action === "BACKUP") return t("events.backupExecuted");
    return log.action;
  };

  const getTableLabel = (tableName: string | null | undefined) => {
    if (!tableName) return "-";
    const labels: Record<string, string> = {
      devices: t("tables.device"),
      configurations: t("tables.configuration"),
      schedules: t("tables.schedule"),
      users: t("tables.user"),
      credentials: t("tables.credential"),
      templates: t("tables.template"),
      backup_templates: t("tables.template"),
      brands: t("tables.brand"),
      categories: t("tables.category"),
    };
    return labels[tableName] || tableName;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", { action: actionFilter !== "all" ? actionFilter : undefined, table_name: tableFilter !== "all" ? tableFilter : undefined, page, page_size: pageSize }],
    queryFn: () => getAuditLogs({
      action: actionFilter !== "all" ? actionFilter : undefined,
      table_name: tableFilter !== "all" ? tableFilter : undefined,
      page,
      page_size: pageSize,
    }),
  });

  const auditLogs = data?.items || [];
  const totalPages = data?.total_pages || 1;
  const totalLogs = data?.total || 0;

  const tableNames = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.table_name).filter(Boolean))) as string[],
    [auditLogs]
  );

  // Filter logs by search term (client-side)
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return auditLogs;
    const term = searchTerm.toLowerCase();
    return auditLogs.filter((log) => {
      const desc = getDescription(log).toLowerCase();
      const user = (log.user?.full_name || log.user?.email || "").toLowerCase();
      const itemName = getItemName(log).toLowerCase();
      return desc.includes(term) || user.includes(term) || itemName.includes(term);
    });
  }, [auditLogs, searchTerm]);

  const changes = selectedLog ? getChanges(selectedLog) : [];

  // Calculate stats
  const createCount = auditLogs.filter(log => log.action === "CREATE").length;
  const updateCount = auditLogs.filter(log => log.action === "UPDATE").length;
  const deleteCount = auditLogs.filter(log => log.action === "DELETE").length;

  const getActionBadgeLabel = (action: string) => {
    if (action === "CREATE") return t("filters.create");
    if (action === "UPDATE") return t("filters.update");
    if (action === "DELETE") return t("filters.delete");
    if (action === "LOGIN") return t("filters.login");
    if (action === "LOGOUT") return "Logout";
    return action;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("logsTitle")}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
              <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("filters.action")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allActions")}</SelectItem>
                  <SelectItem value="CREATE">{t("filters.create")}</SelectItem>
                  <SelectItem value="UPDATE">{t("filters.update")}</SelectItem>
                  <SelectItem value="DELETE">{t("filters.delete")}</SelectItem>
                  <SelectItem value="LOGIN">{t("filters.login")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tableFilter} onValueChange={(value) => { setTableFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t("filters.table")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allTables")}</SelectItem>
                  {tableNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {getTableLabel(name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("none")}
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">{t("columns.datetime")}</TableHead>
                      <TableHead className="w-48">{t("columns.user")}</TableHead>
                      <TableHead className="w-28">{t("columns.action")}</TableHead>
                      <TableHead className="w-32">{t("columns.table")}</TableHead>
                      <TableHead className="w-44">{t("columns.name")}</TableHead>
                      <TableHead>{t("columns.details")}</TableHead>
                      <TableHead className="w-24">{t("columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user?.full_name || log.user?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.action === "DELETE" ? "destructive" :
                              log.action === "CREATE" ? "default" :
                              log.action === "LOGIN" ? "secondary" :
                              "outline"
                            }
                            className={
                              log.action === "CREATE" ? "bg-green-600" :
                              log.action === "UPDATE" ? "bg-purple-600 text-white" :
                              ""
                            }
                          >
                            {getActionBadgeLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{getTableLabel(log.table_name)}</TableCell>
                        <TableCell className="text-sm font-medium">{getItemName(log)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getDescription(log)}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-blue-600 p-0 h-auto"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {tc("details")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {tc("pagination", { current: page, total: totalPages, count: totalLogs })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      {tc("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      {tc("next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalLogs}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stats.total")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{createCount}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stats.creates")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{updateCount}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stats.updates")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{deleteCount}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stats.deletes")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t("detail.title")}
              {selectedLog && (
                <Badge
                  variant={
                    selectedLog.action === "DELETE" ? "destructive" :
                    selectedLog.action === "CREATE" ? "default" :
                    "outline"
                  }
                  className={
                    selectedLog.action === "CREATE" ? "bg-green-600" :
                    selectedLog.action === "UPDATE" ? "bg-purple-600 text-white" :
                    ""
                  }
                >
                  {getActionBadgeLabel(selectedLog.action)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("detail.datetime")}</span>
                  <span className="ml-2">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("detail.executedBy")}</span>
                  <span className="ml-2">{selectedLog.user?.full_name || selectedLog.user?.email || "-"}</span>
                  {selectedLog.ip_address && (
                    <span className="text-muted-foreground ml-2">{t("detail.ip")} {selectedLog.ip_address}</span>
                  )}
                </div>
              </div>

              {/* Operation Description */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium text-blue-600 mb-2">{t("detail.operationDesc")}</h4>
                <p className="text-sm">{getDescription(selectedLog)}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {t("detail.affectedTable")} <span className="font-medium">{getTableLabel(selectedLog.table_name)}</span>
                  {selectedLog.record_id && (
                    <> | {t("detail.recordId")} <span className="font-mono">{selectedLog.record_id}</span></>
                  )}
                </div>
              </div>

              {/* UPDATE: Show changes side by side */}
              {selectedLog.action === "UPDATE" && changes.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Previous Values */}
                  <div>
                    <h4 className="font-medium text-red-600 mb-2 flex items-center gap-1">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                      {t("detail.previousValues")}
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {changes.map((change, idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-red-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{getFieldLabel(change.field)}:</td>
                              <td className="px-3 py-2 text-right font-mono text-red-700">
                                {formatValue(change.old)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* New Values */}
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-1">
                      <ArrowRight className="h-4 w-4" />
                      {t("detail.newValues")}
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {changes.map((change, idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-green-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{getFieldLabel(change.field)}:</td>
                              <td className="px-3 py-2 text-right font-mono text-green-700">
                                {formatValue(change.new)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* CREATE: Show created data */}
              {selectedLog.action === "CREATE" && selectedLog.new_data && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">{t("detail.createdData")}</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedLog.new_data)
                          .filter(([key]) => !["password", "password_hash", "password_encrypted", "id", "user_id", "created_at", "updated_at"].includes(key))
                          .map(([key, value], idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-green-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{getFieldLabel(key)}:</td>
                              <td className="px-3 py-2 text-right font-mono text-green-700">
                                {formatValue(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DELETE: Show deleted data */}
              {selectedLog.action === "DELETE" && selectedLog.old_data && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">{t("detail.deletedData")}</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedLog.old_data)
                          .filter(([key]) => !["password", "password_hash", "password_encrypted", "id", "user_id", "created_at", "updated_at", "changes"].includes(key))
                          .map(([key, value], idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-red-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{getFieldLabel(key)}:</td>
                              <td className="px-3 py-2 text-right font-mono text-red-700">
                                {formatValue(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* LOGIN/LOGOUT: Show session info */}
              {(selectedLog.action === "LOGIN" || selectedLog.action === "LOGOUT") && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium mb-2">{t("detail.sessionInfo")}</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">{t("detail.user")}</span> {selectedLog.user?.email || "-"}</p>
                    {selectedLog.ip_address && (
                      <p><span className="text-muted-foreground">{t("detail.ip")}</span> {selectedLog.ip_address}</p>
                    )}
                    {selectedLog.user_agent && (
                      <p><span className="text-muted-foreground">{t("detail.userAgent")}</span> <span className="font-mono text-xs">{selectedLog.user_agent}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Audit;
