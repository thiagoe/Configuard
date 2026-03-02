import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Plus, Minus } from "lucide-react";

interface ConfigDiffViewerProps {
  oldConfig?: string;
  newConfig?: string;
  oldVersion: number;
  newVersion: number;
  diffText?: string;
  addedLines?: number;
  removedLines?: number;
  viewMode?: "unified" | "split";
  showAllLines?: boolean;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber?: number;
}

const ConfigDiffViewer = ({
  oldConfig = "",
  newConfig = "",
  oldVersion,
  newVersion,
  diffText,
  addedLines,
  removedLines,
  viewMode = "unified",
  showAllLines = false,
}: ConfigDiffViewerProps) => {
  const diffLines = useMemo(() => {
    if (diffText && !showAllLines) {
      const lines = diffText.split("\n");
      let counter = 1;
      return lines
        .filter((line) => line.trim().length > 0)
        .filter((line) => !line.startsWith("+++ ") && !line.startsWith("--- ") && !line.startsWith("@@"))
        .map((line) => {
          if (line.startsWith("+")) {
            return { type: "added", content: line.slice(1), lineNumber: counter++ };
          }
          if (line.startsWith("-")) {
            return { type: "removed", content: line.slice(1), lineNumber: counter++ };
          }
          const content = line.startsWith(" ") ? line.slice(1) : line;
          return { type: "unchanged", content, lineNumber: counter++ };
        });
    }

    const oldLines = oldConfig.split("\n");
    const newLines = newConfig.split("\n");
    const diff: DiffLine[] = [];

    // Simple diff algorithm - can be improved with a proper diff library
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        diff.push({ type: "unchanged", content: oldLine || "", lineNumber: i + 1 });
      } else {
        if (oldLine && !newLines.includes(oldLine)) {
          diff.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
        }
        if (newLine && !oldLines.includes(newLine)) {
          diff.push({ type: "added", content: newLine, lineNumber: i + 1 });
        }
      }
    }

    return diff;
  }, [oldConfig, newConfig, diffText, showAllLines]);

  const stats = useMemo(() => {
    const added = addedLines ?? diffLines.filter((line) => line.type === "added").length;
    const removed = removedLines ?? diffLines.filter((line) => line.type === "removed").length;
    return { added, removed };
  }, [addedLines, removedLines, diffLines]);

  const [activeChangeIndex, setActiveChangeIndex] = useState(0);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const jumpToChange = (direction: "next" | "prev") => {
    if (changeIndices.length === 0) return;
    const current = changeIndices[activeChangeIndex] ?? changeIndices[0];
    const currentPos = changeIndices.indexOf(current);
    const nextPos =
      direction === "next"
        ? (currentPos + 1) % changeIndices.length
        : (currentPos - 1 + changeIndices.length) % changeIndices.length;
    const nextIndex = changeIndices[nextPos];
    setActiveChangeIndex(nextPos);
    const el = lineRefs.current[nextIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const splitRows = useMemo(() => {
    if (viewMode !== "split") return [];
    let leftLine = 1;
    let rightLine = 1;
    return diffLines.map((line) => {
      if (line.type === "removed") {
        return {
          leftNumber: leftLine++,
          leftContent: line.content,
          rightNumber: "",
          rightContent: "",
          type: "removed" as const,
        };
      }
      if (line.type === "added") {
        return {
          leftNumber: "",
          leftContent: "",
          rightNumber: rightLine++,
          rightContent: line.content,
          type: "added" as const,
        };
      }
      return {
        leftNumber: leftLine++,
        leftContent: line.content,
        rightNumber: rightLine++,
        rightContent: line.content,
        type: "unchanged" as const,
      };
    });
  }, [diffLines, viewMode]);

  const changeIndices = useMemo(
    () => diffLines.map((line, index) => (line.type === "unchanged" ? null : index)).filter((idx): idx is number => idx !== null),
    [diffLines]
  );

  return (
    <Card className="border-border bg-card shadow-[var(--shadow-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCompare className="h-5 w-5 text-primary" />
            <CardTitle>Configuration Diff</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center gap-2 text-xs">
              <button
                className="rounded border px-2 py-1 hover:bg-muted"
                onClick={() => jumpToChange("prev")}
                disabled={changeIndices.length === 0}
              >
                Anterior diferença
              </button>
              <button
                className="rounded border px-2 py-1 hover:bg-muted"
                onClick={() => jumpToChange("next")}
                disabled={changeIndices.length === 0}
              >
                Próxima diferença
              </button>
            </div>
            <Badge variant="outline" className="border-destructive/30 text-destructive">
              <Minus className="h-3 w-3 mr-1" />
              {stats.removed} removed
            </Badge>
            <Badge variant="outline" className="border-accent/30 text-accent">
              <Plus className="h-3 w-3 mr-1" />
              {stats.added} added
            </Badge>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Comparing version {oldVersion} → {newVersion}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border overflow-hidden bg-background">
          <div className="overflow-x-auto">
            {viewMode === "split" ? (
              <div className="font-mono text-sm grid grid-cols-2">
                <div className="border-r border-border">
                  <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                    Versão {oldVersion}
                  </div>
                  {splitRows.map((row, index) => (
                    <div
                      key={`left-${index}`}
                      ref={(el) => {
                        if (row.type !== "unchanged") {
                          lineRefs.current[index] = el;
                        }
                      }}
                      className={`flex px-4 py-1 ${
                        row.type === "removed"
                          ? "bg-destructive/10 border-l-2 border-destructive"
                          : row.type === "unchanged"
                          ? "hover:bg-muted/50"
                          : ""
                      }`}
                    >
                      <span className="w-12 text-muted-foreground select-none flex-shrink-0">
                        {row.leftNumber}
                      </span>
                      <span
                        className={`flex-1 ${
                          row.type === "removed"
                            ? "text-destructive line-through"
                            : "text-foreground"
                        }`}
                      >
                        {row.leftContent || " "}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                    Versão {newVersion}
                  </div>
                  {splitRows.map((row, index) => (
                    <div
                      key={`right-${index}`}
                      ref={(el) => {
                        if (row.type !== "unchanged") {
                          lineRefs.current[index] = el;
                        }
                      }}
                      className={`flex px-4 py-1 ${
                        row.type === "added"
                          ? "bg-accent/10 border-l-2 border-accent"
                          : row.type === "unchanged"
                          ? "hover:bg-muted/50"
                          : ""
                      }`}
                    >
                      <span className="w-12 text-muted-foreground select-none flex-shrink-0">
                        {row.rightNumber}
                      </span>
                      <span
                        className={`flex-1 ${
                          row.type === "added"
                            ? "text-accent"
                            : "text-foreground"
                        }`}
                      >
                        {row.rightContent || " "}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="font-mono text-sm">
                {diffLines.map((line, index) => (
                  <div
                    key={index}
                    ref={(el) => (lineRefs.current[index] = el)}
                    className={`flex px-4 py-1 ${
                      line.type === "added"
                        ? "bg-accent/10 border-l-2 border-accent"
                        : line.type === "removed"
                        ? "bg-destructive/10 border-l-2 border-destructive"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="w-12 text-muted-foreground select-none flex-shrink-0">
                      {line.lineNumber}
                    </span>
                    <span
                      className={`flex-1 ${
                        line.type === "added"
                          ? "text-accent"
                          : line.type === "removed"
                          ? "text-destructive line-through"
                          : "text-foreground"
                      }`}
                    >
                      {line.type === "added" && "+ "}
                      {line.type === "removed" && "- "}
                      {line.content || " "}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigDiffViewer;
