import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Eye, ArrowRight } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: { id: string; email: string; full_name?: string } | null;
}

interface ChangeDetail {
  field: string;
  old: unknown;
  new: unknown;
}

const getChanges = (log: AuditLog): ChangeDetail[] => {
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

const AuditLogs = () => {
  const { t, i18n } = useTranslation("admin");
  const dateFnsLocale = i18n.language === "pt-BR" ? ptBR : enUS;
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return t("audit.desc.empty");
    if (typeof value === "string") return value || t("audit.desc.empty");
    if (typeof value === "boolean") return value ? t("audit.desc.yes") : t("audit.desc.no");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const getDescription = (log: AuditLog): string => {
    const tableName = log.table_name || t("audit.desc.record");

    if (log.action === "CREATE") {
      const name = log.new_data?.name as string | undefined;
      return name
        ? t("audit.desc.created", { table: tableName, name })
        : t("audit.desc.createdNoName", { table: tableName });
    }
    if (log.action === "DELETE") {
      const name = log.old_data?.name as string | undefined;
      return name
        ? t("audit.desc.deleted", { table: tableName, name })
        : t("audit.desc.deletedNoName", { table: tableName });
    }
    if (log.action === "UPDATE") {
      const name = (log.new_data?.name || log.old_data?.name) as string | undefined;
      const changes = getChanges(log);
      if (name) {
        return t("audit.desc.updated", { table: tableName, name });
      }
      if (changes.length === 1) {
        return t("audit.desc.fieldChanged", { field: changes[0].field });
      }
      return t("audit.desc.fieldsChanged", { count: changes.length });
    }
    if (log.action === "LOGIN") {
      return t("audit.desc.login");
    }
    if (log.action === "LOGOUT") {
      return t("audit.desc.logout");
    }
    return log.action;
  };

  const getActionLabel = (action: string): string => {
    const key = `audit.actions.${action}` as any;
    const label = t(key);
    return label !== key ? label : action;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, tableFilter],
    queryFn: () =>
      getAuditLogs({
        page: 1,
        page_size: 200,
        action: actionFilter !== "all" ? actionFilter : undefined,
        table_name: tableFilter || undefined,
      }),
  });

  const logs = data?.items || [];
  const tableNames = useMemo(
    () => Array.from(new Set(logs.map((l) => l.table_name).filter(Boolean))) as string[],
    [logs]
  );

  const filteredLogs = useMemo(() => {
    if (!searchText) return logs;
    const search = searchText.toLowerCase();
    return logs.filter((log: AuditLog) => {
      const desc = getDescription(log).toLowerCase();
      const user = (log.user?.full_name || log.user?.email || "").toLowerCase();
      return desc.includes(search) || user.includes(search);
    });
  }, [logs, searchText]);

  const changes = selectedLog ? getChanges(selectedLog) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("audit.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t("audit.searchPlaceholder")}
              className="w-64"
            />

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("audit.actionFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allActions")}</SelectItem>
                <SelectItem value="CREATE">{t("audit.actions.CREATE")}</SelectItem>
                <SelectItem value="UPDATE">{t("audit.actions.UPDATE")}</SelectItem>
                <SelectItem value="DELETE">{t("audit.actions.DELETE")}</SelectItem>
                <SelectItem value="LOGIN">{t("audit.actions.LOGIN")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tableFilter || "all"} onValueChange={(v) => setTableFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t("audit.tableFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allTables")}</SelectItem>
                {tableNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t("audit.loading")}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">{t("audit.columns.datetime")}</TableHead>
                    <TableHead className="w-48">{t("audit.columns.user")}</TableHead>
                    <TableHead className="w-28">{t("audit.columns.action")}</TableHead>
                    <TableHead className="w-32">{t("audit.columns.table")}</TableHead>
                    <TableHead>{t("audit.columns.description")}</TableHead>
                    <TableHead className="w-20">{t("audit.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: AuditLog) => (
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
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.table_name || "-"}</TableCell>
                      <TableCell className="text-sm">{getDescription(log)}</TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-blue-600 p-0 h-auto"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t("audit.details")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {t("audit.noRecords")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t("audit.dialog.title")}
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
                  {getActionLabel(selectedLog.action)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("audit.dialog.datetime")}</span>
                  <span className="ml-2">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: dateFnsLocale })}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("audit.dialog.executedBy")}</span>
                  <span className="ml-2">{selectedLog.user?.full_name || selectedLog.user?.email || "-"}</span>
                  {selectedLog.ip_address && (
                    <span className="text-muted-foreground ml-2">{t("audit.dialog.ip")} {selectedLog.ip_address}</span>
                  )}
                </div>
              </div>

              {/* Operation description */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium text-blue-600 mb-2">{t("audit.dialog.operationDesc")}</h4>
                <p className="text-sm">{getDescription(selectedLog)}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {t("audit.dialog.affectedTable")} <span className="font-medium">{selectedLog.table_name || "-"}</span>
                  {selectedLog.record_id && (
                    <> | {t("audit.dialog.recordId")} <span className="font-mono">{selectedLog.record_id}</span></>
                  )}
                </div>
              </div>

              {/* UPDATE: Show changes side-by-side */}
              {selectedLog.action === "UPDATE" && changes.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-red-600 mb-2 flex items-center gap-1">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                      {t("audit.dialog.previousValues")}
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {changes.map((change, idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-red-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{change.field}:</td>
                              <td className="px-3 py-2 text-right font-mono text-red-700">
                                {formatValue(change.old)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-1">
                      <ArrowRight className="h-4 w-4" />
                      {t("audit.dialog.newValues")}
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {changes.map((change, idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-green-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{change.field}:</td>
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
                  <h4 className="font-medium text-green-600 mb-2">{t("audit.dialog.createdData")}</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedLog.new_data)
                          .filter(([key]) => !["password", "password_hash", "password_encrypted"].includes(key))
                          .map(([key, value], idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-green-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{key}:</td>
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
                  <h4 className="font-medium text-red-600 mb-2">{t("audit.dialog.deletedData")}</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selectedLog.old_data)
                          .filter(([key]) => !["password", "password_hash", "password_encrypted"].includes(key))
                          .map(([key, value], idx) => (
                            <tr key={idx} className="border-b last:border-b-0 bg-red-50">
                              <td className="px-3 py-2 text-muted-foreground w-1/3">{key}:</td>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuditLogs;
