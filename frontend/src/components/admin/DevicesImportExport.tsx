import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { exportDevices, importDevices, DeviceImportResult } from "@/services/devices";

interface CsvRow {
  name: string;
  ip_address: string;
  hostname?: string;
  port?: string;
  protocol?: string;
  brand_name?: string;
  category_name?: string;
  model_name?: string;
  credential_name?: string;
  status?: string;
  notes?: string;
  [key: string]: string | undefined;
}

function parseCsvPreview(text: string): CsvRow[] {
  // Strip BOM
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    // Simple CSV split (handles quoted fields with commas inside)
    const values: string[] = [];
    let current = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { values.push(current); current = ""; continue; }
      current += ch;
    }
    values.push(current);
    const row: CsvRow = { name: "", ip_address: "" };
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  }).filter((r) => r.name || r.ip_address);
}

export function DevicesImportExport() {
  const { t } = useTranslation("admin");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<CsvRow[] | null>(null);
  const [importResult, setImportResult] = useState<DeviceImportResult | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportDevices();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devices_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("importExport.export.success"));
    } catch {
      toast.error(t("importExport.export.error"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCsvPreview(text);
        if (rows.length === 0) {
          toast.error(t("importExport.import.invalidFile"));
          setPreviewRows(null);
          setSelectedFile(null);
          return;
        }
        setPreviewRows(rows);
      } catch {
        toast.error(t("importExport.import.invalidFile"));
        setPreviewRows(null);
        setSelectedFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    try {
      setImporting(true);
      const result = await importDevices(selectedFile);
      setImportResult(result);
      setPreviewRows(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const parts = [
        t("importExport.import.result.created", { count: result.created }),
        t("importExport.import.result.skipped", { count: result.skipped }),
        result.errors.length > 0
          ? t("importExport.import.result.errors", { count: result.errors.length })
          : null,
      ].filter(Boolean).join(" · ");

      if (result.errors.length === 0) {
        toast.success(`${t("importExport.import.result.title")}: ${parts}`);
      } else {
        toast.warning(`${t("importExport.import.result.title")}: ${parts}`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t("importExport.export.error"));
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setPreviewRows(null);
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("importExport.export.title")}
          </CardTitle>
          <CardDescription>{t("importExport.export.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            {exporting ? t("importExport.export.downloading") : t("importExport.export.button")}
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("importExport.import.title")}
          </CardTitle>
          <CardDescription>{t("importExport.import.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="import-file-input"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t("importExport.import.selectFile")}
            </Button>
            {selectedFile && (
              <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
            )}
            {previewRows && (
              <Button variant="ghost" size="sm" onClick={resetImport} disabled={importing}>
                ✕
              </Button>
            )}
          </div>

          {/* Preview table */}
          {previewRows && previewRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("importExport.import.preview")}
              </p>
              <div className="rounded-md border max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("importExport.import.columns.name")}</TableHead>
                      <TableHead>{t("importExport.import.columns.ip")}</TableHead>
                      <TableHead className="w-20">{t("importExport.import.columns.port")}</TableHead>
                      <TableHead className="w-24">{t("importExport.import.columns.protocol")}</TableHead>
                      <TableHead>{t("importExport.import.columns.brand")}</TableHead>
                      <TableHead>{t("importExport.import.columns.category")}</TableHead>
                      <TableHead>{t("importExport.import.columns.model")}</TableHead>
                      <TableHead>{t("importExport.import.columns.credential")}</TableHead>
                      <TableHead className="w-24">{t("importExport.import.columns.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.ip_address}</TableCell>
                        <TableCell>{row.port || (row.protocol === "telnet" ? "23" : "22")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {row.protocol || "ssh"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.brand_name || "-"}</TableCell>
                        <TableCell>{row.category_name || "-"}</TableCell>
                        <TableCell>{row.model_name || "-"}</TableCell>
                        <TableCell>{row.credential_name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              !row.status || row.status === "active" ? "default" : "secondary"
                            }
                          >
                            {row.status || "active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {importing
                  ? t("importExport.import.importing")
                  : t("importExport.import.button", { count: previewRows.length })}
              </Button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                {t("importExport.import.result.title")}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-700">
                  {t("importExport.import.result.created", { count: importResult.created })}
                </span>
                <span className="text-muted-foreground">
                  {t("importExport.import.result.skipped", { count: importResult.skipped })}
                </span>
                {importResult.errors.length > 0 && (
                  <span className="text-red-600">
                    {t("importExport.import.result.errors", { count: importResult.errors.length })}
                  </span>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <ul className="text-xs text-red-600 space-y-1 mt-2">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>
                      {t("importExport.import.errorDetail", {
                        row: err.row,
                        name: err.name,
                        error: err.error,
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
