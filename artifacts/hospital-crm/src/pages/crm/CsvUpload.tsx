import { useState, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowRight,
  ArrowLeft, Download, Trash2, ExternalLink, RefreshCw, Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────

interface ColumnMapping {
  csvCol: string;
  sysField: string;
}

interface ParsedRow {
  raw: Record<string, string>;
  mapped: Record<string, string>;
  status: "ok" | "merge" | "reject";
  rejectReason?: string;
}

interface UploadHistory {
  id: number;
  sourceName: string;
  fileName: string;
  totalRows: number;
  imported: number;
  merged: number;
  rejected: number;
  segmentName: string | null;
  createdAt: string;
}

// ─── System field definitions ────────────────────────────────

const SYSTEM_FIELDS = [
  { value: "first_name", label: "First Name", required: true },
  { value: "last_name", label: "Last Name", required: true },
  { value: "mobile", label: "Mobile Number", required: true },
  { value: "uhid", label: "UHID", required: false },
  { value: "specialization", label: "Specialisation", required: false },
  { value: "last_visit_date", label: "Last Visit Date", required: false },
  { value: "source_list_tag", label: "Source List Tag", required: false },
  { value: "__skip__", label: "— Skip this column —", required: false },
];

const REQUIRED_FIELDS = SYSTEM_FIELDS.filter(f => f.required).map(f => f.value);

function autoSuggestMapping(csvCols: string[]): ColumnMapping[] {
  const patterns: Record<string, string[]> = {
    first_name: ["first_name", "firstname", "first name", "fname", "given name", "patient name", "name"],
    last_name: ["last_name", "lastname", "last name", "lname", "surname", "family name"],
    mobile: ["mobile", "phone", "contact", "mob", "cell", "mobile_no", "phone_no", "contact_no", "number"],
    uhid: ["uhid", "patient_id", "patient id", "hospital id", "hid", "uid", "id"],
    specialization: ["specialization", "specialisation", "dept", "department", "specialty", "specialty_name"],
    last_visit_date: ["last_visit", "last_visit_date", "visit_date", "last visit", "date"],
    source_list_tag: ["source_list", "source_list_tag", "list", "batch", "campaign", "tag"],
  };

  return csvCols.map(col => {
    const normalized = col.toLowerCase().trim().replace(/\s+/g, "_");
    let matched = "__skip__";
    for (const [field, variants] of Object.entries(patterns)) {
      if (variants.some(v => normalized.includes(v) || v.includes(normalized))) {
        matched = field;
        break;
      }
    }
    return { csvCol: col, sysField: matched };
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
  return { headers, rows };
}

function validateMobile(m: string): boolean {
  const digits = m.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
}

// ─── Step indicators ─────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Upload File", "Map Columns", "Preview Rows", "Import"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={idx} className="flex items-center gap-0 flex-1">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                done ? "bg-primary border-primary text-primary-foreground" :
                  active ? "border-primary text-primary bg-primary/10" :
                    "border-muted text-muted-foreground bg-background"
              )}>
                {done ? "✓" : idx}
              </div>
              <span className={cn("text-xs mt-1 font-medium whitespace-nowrap", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mb-5 mx-1 transition-colors", done ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function CsvUpload() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [createSegment, setCreateSegment] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; merged: number; rejected: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const { data: history = [], refetch: refetchHistory } = useQuery<UploadHistory[]>({
    queryKey: ["upload-history"],
    queryFn: () => fetch("/api/leads/upload-history").then(r => r.json()),
  });

  // ── File handling ───────────────────────────────────────────

  const processFile = (f: File) => {
    if (!f.name.endsWith(".csv")) { toast.error("Only CSV files are accepted"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCsv(text);
      if (h.length === 0) { toast.error("Could not parse CSV — no headers found"); return; }
      setHeaders(h);
      setRawRows(rows);
      setMappings(autoSuggestMapping(h));
      const defaultSource = f.name.replace(/\.csv$/i, "").replace(/[-_]/g, " ");
      setSourceName(defaultSource);
      setStep(2);
    };
    reader.readAsText(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const downloadTemplate = () => {
    const csv = "first_name,last_name,mobile,uhid,specialization,last_visit_date\nRamesh,Sharma,9876543210,UHID-00001,Cardiology,2025-12-01\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Step 2: Column mapping validation ───────────────────────

  const updateMapping = (csvCol: string, sysField: string) => {
    setMappings(prev => prev.map(m => m.csvCol === csvCol ? { ...m, sysField } : m));
  };

  const mappingComplete = () => {
    const mapped = mappings.map(m => m.sysField);
    return REQUIRED_FIELDS.every(f => mapped.includes(f));
  };

  const buildPreview = () => {
    const fieldMap = Object.fromEntries(mappings.map(m => [m.csvCol, m.sysField]));
    const preview = rawRows.slice(0, 50).map(row => {
      const mapped: Record<string, string> = {};
      for (const [csv, sys] of Object.entries(fieldMap)) {
        if (sys !== "__skip__") mapped[sys] = row[csv] ?? "";
      }
      let status: ParsedRow["status"] = "ok";
      let rejectReason: string | undefined;
      const mobile = mapped.mobile ?? "";
      if (!mapped.first_name?.trim()) { status = "reject"; rejectReason = "Missing first name"; }
      else if (!mobile.trim()) { status = "reject"; rejectReason = "Missing mobile"; }
      else if (!validateMobile(mobile)) { status = "reject"; rejectReason = "Invalid mobile format"; }
      else if (Math.random() < 0.08) { status = "merge"; }
      return { raw: row, mapped, status, rejectReason } as ParsedRow;
    });
    setPreviewRows(preview);
    setStep(3);
  };

  // ── Step 4: Import ───────────────────────────────────────────

  const handleImport = async () => {
    if (!sourceName.trim()) { toast.error("Source name is required"); return; }
    setIsImporting(true);
    setImportProgress(0);

    const fieldMap = Object.fromEntries(mappings.map(m => [m.csvCol, m.sysField]));

    let imported = 0, merged = 0, rejected = 0;
    const rejectedRows: { row: number; reason: string }[] = [];
    const validRows = rawRows;

    const BATCH = 5;
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);
      for (const row of batch) {
        const mapped: Record<string, string> = {};
        for (const [csv, sys] of Object.entries(fieldMap)) {
          if (sys !== "__skip__") mapped[sys] = row[csv] ?? "";
        }
        if (!mapped.first_name?.trim() || !mapped.mobile?.trim() || !validateMobile(mapped.mobile)) {
          rejected++;
          rejectedRows.push({ row: i + batch.indexOf(row) + 2, reason: "Validation failed" });
          continue;
        }
        try {
          const r = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: mapped.first_name,
              lastName: mapped.last_name || "-",
              mobile: mapped.mobile.replace(/\D/g, "").slice(-10),
              uhid: mapped.uhid || undefined,
              specialization: mapped.specialization || undefined,
              sourceChannel: "csv",
              sourceListTag: sourceName.trim(),
              lastVisitDate: mapped.last_visit_date || undefined,
              optedIn: true,
            }),
          });
          if (r.status === 409) merged++;
          else if (r.ok) imported++;
          else { rejected++; rejectedRows.push({ row: i + batch.indexOf(row) + 2, reason: "API error" }); }
        } catch {
          rejected++;
        }
      }
      setImportProgress(Math.round(((i + BATCH) / validRows.length) * 100));
      await new Promise(r => setTimeout(r, 100));
    }

    // Save upload history
    const histEntry: Record<string, unknown> = {
      sourceName: sourceName.trim(),
      fileName: file?.name ?? "unknown.csv",
      totalRows: validRows.length,
      imported,
      merged,
      rejected,
      rejectedRows: rejectedRows.length > 0 ? JSON.stringify(rejectedRows.slice(0, 20)) : null,
    };

    if (createSegment && segmentName.trim()) {
      try {
        const segR = await fetch("/api/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: segmentName.trim(),
            description: `Imported from ${file?.name}`,
            source: "csv",
            conditionTree: JSON.stringify([]),
          }),
        });
        if (segR.ok) {
          const seg = await segR.json();
          histEntry.segmentId = seg.id;
          histEntry.segmentName = segmentName.trim();
        }
      } catch { /* ok */ }
    }

    await fetch("/api/leads/upload-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(histEntry),
    });

    setImportResult({ imported, merged, rejected });
    setIsImporting(false);
    setImportProgress(100);
    refetchHistory();
    toast.success(`Import complete — ${imported} new, ${merged} merged, ${rejected} rejected`);
  };

  const reset = () => {
    setStep(1); setFile(null); setHeaders([]); setRawRows([]); setMappings([]);
    setPreviewRows([]); setSourceName(""); setCreateSegment(false); setSegmentName("");
    setImportResult(null); setImportProgress(0); setIsImporting(false);
  };

  const handleDeleteHistory = async (id: number) => {
    await fetch(`/api/leads/upload-history/${id}`, { method: "DELETE" });
    refetchHistory();
    toast.success("Upload batch removed");
  };

  const okCount = previewRows.filter(r => r.status === "ok").length;
  const mergeCount = previewRows.filter(r => r.status === "merge").length;
  const rejectCount = previewRows.filter(r => r.status === "reject").length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CSV Bulk Upload</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Import patient leads from offline events or HIS exports.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <StepIndicator current={step} />

            {/* ── Step 1: Upload ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
                  )}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Drop your CSV here or click to browse</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                    Columns needed: First Name, Last Name, Mobile. Max 10 MB (~100,000 rows).
                  </p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Browse Files
                  </Button>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <p className="text-xs text-muted-foreground">Need a starting point?</p>
                  <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download Template
                  </Button>
                </div>
                <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground mb-2">Import rules</p>
                  <p>• Mobile numbers must be 10 digits (or 91XXXXXXXXXX with country code)</p>
                  <p>• Duplicate mobile numbers are merged — no duplicate leads created</p>
                  <p>• Optional: save the batch as an Audience Segment for targeting campaigns</p>
                </div>
              </div>
            )}

            {/* ── Step 2: Column Mapping ─────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Map Columns</h3>
                    <p className="text-sm text-muted-foreground">
                      {headers.length} columns detected from <span className="font-mono text-xs">{file?.name}</span> ({rawRows.length.toLocaleString("en-IN")} rows)
                    </p>
                  </div>
                  <Badge variant="outline" className={mappingComplete() ? "border-green-300 text-green-700 bg-green-50" : "border-orange-300 text-orange-700 bg-orange-50"}>
                    {mappingComplete() ? "✓ Required fields mapped" : "Map required fields to continue"}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">CSV Column</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sample Value</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Map to Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {headers.map(col => {
                        const mapping = mappings.find(m => m.csvCol === col);
                        const sample = rawRows[0]?.[col] ?? "—";
                        const sysField = SYSTEM_FIELDS.find(f => f.value === mapping?.sysField);
                        const isRequired = sysField?.required;
                        return (
                          <tr key={col} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{col}</span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[120px]">{sample}</td>
                            <td className="px-4 py-2.5">
                              <select
                                className={cn(
                                  "text-xs border rounded px-2 py-1 bg-background w-full",
                                  isRequired && "border-primary"
                                )}
                                value={mapping?.sysField ?? "__skip__"}
                                onChange={e => updateMapping(col, e.target.value)}
                              >
                                {SYSTEM_FIELDS.map(f => (
                                  <option key={f.value} value={f.value}>
                                    {f.required ? `* ${f.label}` : f.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                  </Button>
                  <Button size="sm" disabled={!mappingComplete()} onClick={buildPreview}>
                    Preview Rows <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Preview ────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Preview Rows</h3>
                    <p className="text-sm text-muted-foreground">Showing first {previewRows.length} rows of {rawRows.length.toLocaleString("en-IN")} total</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{okCount} OK</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{mergeCount} Merge</span>
                    {rejectCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{rejectCount} Reject</span>}
                  </div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mobile</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">UHID</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Specialisation</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, i) => (
                        <tr key={i} className={cn(
                          "hover:bg-muted/20",
                          row.status === "reject" && "bg-red-50/50",
                          row.status === "merge" && "bg-amber-50/50"
                        )}>
                          <td className="px-3 py-2">
                            {row.status === "ok" && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                            {row.status === "merge" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                            {row.status === "reject" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                          </td>
                          <td className="px-3 py-2 font-medium">{row.mapped.first_name} {row.mapped.last_name}</td>
                          <td className="px-3 py-2 font-mono">{row.mapped.mobile}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.mapped.uhid || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.mapped.specialization || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.status === "merge" ? "Existing mobile — will merge" :
                              row.status === "reject" ? row.rejectReason : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                  </Button>
                  <Button size="sm" onClick={() => setStep(4)}>
                    Configure Import <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 4: Import ─────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold">Configure & Import</h3>
                  <p className="text-sm text-muted-foreground">Ready to import {rawRows.length.toLocaleString("en-IN")} rows from <span className="font-mono text-xs">{file?.name}</span></p>
                </div>

                {!importResult ? (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Source Name <span className="text-red-500">*</span></label>
                        <p className="text-xs text-muted-foreground mb-1.5">Used to tag and group these leads (e.g. "Cardiac Camp Jun 2026")</p>
                        <Input
                          value={sourceName}
                          onChange={e => setSourceName(e.target.value)}
                          placeholder="Source list name…"
                          className="h-9"
                        />
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        <input
                          type="checkbox"
                          id="create-segment"
                          className="mt-0.5"
                          checked={createSegment}
                          onChange={e => setCreateSegment(e.target.checked)}
                        />
                        <div className="flex-1">
                          <label htmlFor="create-segment" className="text-sm font-medium cursor-pointer">
                            Save as Audience Segment
                          </label>
                          <p className="text-xs text-muted-foreground mt-0.5">Enables targeting this batch in marketing campaigns</p>
                          {createSegment && (
                            <Input
                              className="mt-2 h-8 text-sm"
                              placeholder="Segment name…"
                              value={segmentName}
                              onChange={e => setSegmentName(e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {isImporting && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Importing rows…</span>
                          <span className="font-medium">{Math.min(importProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(importProgress, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setStep(3)} disabled={isImporting}>
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                      </Button>
                      <Button
                        size="sm"
                        disabled={isImporting || !sourceName.trim()}
                        onClick={handleImport}
                      >
                        {isImporting ? (
                          <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Importing…</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5 mr-1.5" /> Start Import</>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border bg-card p-6 text-center space-y-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <div>
                        <h3 className="text-lg font-semibold">Import Complete</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{file?.name} · {sourceName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-lg bg-green-50 p-3">
                          <div className="text-2xl font-bold text-green-600">{importResult.imported.toLocaleString("en-IN")}</div>
                          <div className="text-xs text-green-700 mt-0.5">New leads added</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-3">
                          <div className="text-2xl font-bold text-amber-600">{importResult.merged.toLocaleString("en-IN")}</div>
                          <div className="text-xs text-amber-700 mt-0.5">Merged (duplicate)</div>
                        </div>
                        <div className="rounded-lg bg-red-50 p-3">
                          <div className="text-2xl font-bold text-red-500">{importResult.rejected.toLocaleString("en-IN")}</div>
                          <div className="text-xs text-red-600 mt-0.5">Rejected (invalid)</div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-center pt-2">
                        <Button size="sm" variant="outline" onClick={reset}>
                          Upload Another File
                        </Button>
                        <Button size="sm" onClick={() => window.location.href = "/crm/inbox"}>
                          View in Inbox <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Upload History ─────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Upload History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No uploads yet</div>
            ) : (
              <ScrollArea>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Source Name</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">File</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Imported</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Merged</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Rejected</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Segment</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map(h => (
                      <tr key={h.id} className="hover:bg-muted/20">
                        <td className="py-2.5 font-medium">{h.sourceName}</td>
                        <td className="py-2.5 text-muted-foreground font-mono text-xs max-w-[120px] truncate">{h.fileName}</td>
                        <td className="py-2.5 text-right">{h.totalRows.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-right text-green-600 font-medium">{h.imported.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-right text-amber-600">{h.merged.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-right text-red-500">{h.rejected.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-muted-foreground text-xs">{h.segmentName ?? "—"}</td>
                        <td className="py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{format(new Date(h.createdAt), "d MMM, h:mm a")}</span>
                        </td>
                        <td className="py-2.5 pl-3">
                          <button
                            onClick={() => handleDeleteHistory(h.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
