import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  GripVertical,
  Trash2,
  Terminal,
  Clock,
  Search,
  Settings2,
  LogIn,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Keyboard
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface TemplateStep {
  id: string;
  template_id: string;
  step_order: number;
  step_type: "command" | "expect" | "pause" | "set_prompt" | "enter_mode" | "send_key";
  command: string | null;
  expect_pattern: string | null;
  timeout_seconds: number;
  delay_ms: number;
  capture_output: boolean;
  on_error: "continue" | "stop" | "retry";
  retry_count: number;
  description: string | null;
  enabled: boolean;
}

interface TemplateStepEditorProps {
  steps: TemplateStep[];
  onStepsChange: (steps: TemplateStep[]) => void;
  templateId: string;
}

const TemplateStepEditor = ({ steps, onStepsChange, templateId }: TemplateStepEditorProps) => {
  const { t } = useTranslation("templates");
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<string, DOMRect>>(new Map());

  const stepTypeConfig = {
    command: {
      label: t("steps.types.command"),
      icon: Terminal,
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      description: t("steps.types.commandDesc"),
    },
    expect: {
      label: t("steps.types.expect"),
      icon: Search,
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      description: t("steps.types.expectDesc"),
    },
    pause: {
      label: t("steps.types.pause"),
      icon: Clock,
      color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      description: t("steps.types.pauseDesc"),
    },
    set_prompt: {
      label: t("steps.types.setPrompt"),
      icon: Settings2,
      color: "bg-green-500/10 text-green-500 border-green-500/20",
      description: t("steps.types.setPromptDesc"),
    },
    enter_mode: {
      label: t("steps.types.enterMode"),
      icon: LogIn,
      color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      description: t("steps.types.enterModeDesc"),
    },
    send_key: {
      label: t("steps.types.sendKey"),
      icon: Keyboard,
      color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
      description: t("steps.types.sendKeyDesc"),
    },
  };

  useLayoutEffect(() => {
    const newPositions = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, id) => {
      newPositions.set(id, el.getBoundingClientRect());
    });

    prevPositions.current.forEach((prev, id) => {
      const el = itemRefs.current.get(id);
      const next = newPositions.get(id);
      if (!el || !prev || !next) return;
      const deltaY = prev.top - next.top;
      if (deltaY === 0) return;

      el.style.transform = `translateY(${deltaY}px)`;
      el.style.transition = "transform 0s";
      requestAnimationFrame(() => {
        el.style.transition = "transform 200ms ease";
        el.style.transform = "";
      });
    });

    prevPositions.current = newPositions;
  }, [steps]);

  const createNewStep = (type: TemplateStep["step_type"]): TemplateStep => ({
    id: crypto.randomUUID(),
    template_id: templateId,
    step_order: steps.length,
    step_type: type,
    command: type === "command" || type === "enter_mode" ? "" : type === "send_key" ? "enter" : null,
    expect_pattern: type === "expect" || type === "set_prompt" ? "" : null,
    timeout_seconds: type === "send_key" ? 1 : 30,
    delay_ms: type === "pause" ? 1000 : 0,
    capture_output: type === "command" || type === "enter_mode",
    on_error: "continue",
    retry_count: 0,
    description: null,
    enabled: true,
  });

  const addStep = (type: TemplateStep["step_type"]) => {
    const newStep = createNewStep(type);
    onStepsChange([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const updateStep = (id: string, updates: Partial<TemplateStep>) => {
    onStepsChange(
      steps.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  const removeStep = (id: string) => {
    onStepsChange(
      steps
        .filter((step) => step.id !== id)
        .map((step, idx) => ({ ...step, step_order: idx }))
    );
  };

  const duplicateStep = (step: TemplateStep) => {
    const newStep = {
      ...step,
      id: crypto.randomUUID(),
      step_order: steps.length,
    };
    onStepsChange([...steps, newStep]);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    onStepsChange(newSteps.map((step, idx) => ({ ...step, step_order: idx })));
  };

  const reorderSteps = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
    const sourceIndex = ordered.findIndex((step) => step.id === sourceId);
    const targetIndex = ordered.findIndex((step) => step.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrdered = [...ordered];
    const [moved] = newOrdered.splice(sourceIndex, 1);
    newOrdered.splice(targetIndex, 0, moved);
    onStepsChange(newOrdered.map((step, idx) => ({ ...step, step_order: idx })));
  };

  const renderStepContent = (step: TemplateStep) => {
    const config = stepTypeConfig[step.step_type] || stepTypeConfig.command;
    const Icon = config.icon;

    return (
      <Collapsible key={step.id} open={expandedStep === step.id} onOpenChange={(open) => setExpandedStep(open ? step.id : null)}>
        <div
          ref={(node) => {
            if (node) itemRefs.current.set(step.id, node);
            else itemRefs.current.delete(step.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingId) reorderSteps(draggingId, step.id);
            setDraggingId(null);
          }}
          onDragEnd={() => setDraggingId(null)}
        >
          <Card className={`border ${!step.enabled ? "opacity-50" : ""} ${draggingId === step.id ? "ring-2 ring-primary/50" : ""}`}>
            <CardHeader className="p-3">
              <div className="flex items-center gap-2">
                <span
                  data-drag-handle
                  className="inline-flex"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", step.id);
                    setDraggingId(step.id);
                  }}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                </span>

              <Badge variant="outline" className={config.color}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>

              <span className="flex-1 text-sm font-mono truncate">
                {step.step_type === "command" && step.command}
                {step.step_type === "expect" && `${t("steps.types.expect")}: ${step.expect_pattern}`}
                {step.step_type === "pause" && `${t("steps.types.pause")}: ${step.delay_ms}ms`}
                {step.step_type === "set_prompt" && `${t("steps.types.setPrompt")}: ${step.expect_pattern}`}
                {step.step_type === "enter_mode" && step.command}
                {step.step_type === "send_key" && `${t("steps.types.sendKey")}: ${step.command || "enter"}`}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => moveStep(steps.indexOf(step), "up")}
                  disabled={steps.indexOf(step) === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => moveStep(steps.indexOf(step), "down")}
                  disabled={steps.indexOf(step) === steps.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => duplicateStep(step)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => removeStep(step.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" type="button">
                    {expandedStep === step.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 px-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Command/Pattern Input */}
                {(step.step_type === "command" || step.step_type === "enter_mode") && (
                  <div className="col-span-2 space-y-2">
                    <Label>{t("steps.fields.command")}</Label>
                    <Input
                      value={step.command || ""}
                      onChange={(e) => updateStep(step.id, { command: e.target.value })}
                      placeholder="show running-config"
                      className="font-mono"
                    />
                  </div>
                )}

                {(step.step_type === "expect" || step.step_type === "set_prompt") && (
                  <div className="col-span-2 space-y-2">
                    <Label>{t("steps.fields.pattern")}</Label>
                    <Input
                      value={step.expect_pattern || ""}
                      onChange={(e) => updateStep(step.id, { expect_pattern: e.target.value })}
                      placeholder="#|>|\$"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("steps.fields.patternHint")}
                    </p>
                  </div>
                )}

                {step.step_type === "send_key" && (
                  <div className="col-span-2 space-y-2">
                    <Label>{t("steps.fields.key")}</Label>
                    <Select
                      modal={false}
                      value={step.command || "enter"}
                      onValueChange={(value) => updateStep(step.id, { command: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enter">Enter</SelectItem>
                        <SelectItem value="space">{t("steps.keys.space")}</SelectItem>
                        <SelectItem value="tab">Tab</SelectItem>
                        <SelectItem value="escape">Escape</SelectItem>
                        <SelectItem value="ctrl+c">Ctrl+C</SelectItem>
                        <SelectItem value="ctrl+z">Ctrl+Z</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("steps.fields.keyHint")}
                    </p>
                  </div>
                )}

                {step.step_type === "pause" && (
                  <div className="col-span-2 space-y-2">
                    <Label>{t("steps.fields.pauseTime")}</Label>
                    <Input
                      type="number"
                      value={step.delay_ms}
                      onChange={(e) => updateStep(step.id, { delay_ms: parseInt(e.target.value) || 0 })}
                      min={0}
                      step={100}
                    />
                  </div>
                )}

                {/* Timeout / Delay */}
                {step.step_type === "send_key" && (
                  <div className="space-y-2">
                    <Label>{t("steps.fields.keyDelay")}</Label>
                    <Input
                      type="number"
                      value={step.timeout_seconds}
                      onChange={(e) => updateStep(step.id, { timeout_seconds: parseInt(e.target.value) || 1 })}
                      min={0}
                      max={30}
                    />
                  </div>
                )}
                {step.step_type !== "pause" && step.step_type !== "send_key" && (
                  <div className="space-y-2">
                    <Label>{t("steps.fields.timeout")}</Label>
                    <Input
                      type="number"
                      value={step.timeout_seconds}
                      onChange={(e) => updateStep(step.id, { timeout_seconds: parseInt(e.target.value) || 30 })}
                      min={1}
                      max={300}
                    />
                  </div>
                )}

                {/* Delay after command */}
                {step.step_type === "command" && (
                  <div className="space-y-2">
                    <Label>{t("steps.fields.commandDelay")}</Label>
                    <Input
                      type="number"
                      value={step.delay_ms}
                      onChange={(e) => updateStep(step.id, { delay_ms: parseInt(e.target.value) || 0 })}
                      min={0}
                      step={100}
                    />
                  </div>
                )}

                {/* On Error */}
                <div className="space-y-2">
                  <Label>{t("steps.fields.onError")}</Label>
                  <Select
                    modal={false}
                    value={step.on_error}
                    onValueChange={(value) => updateStep(step.id, { on_error: value as TemplateStep["on_error"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continue">{t("steps.onError.continue")}</SelectItem>
                      <SelectItem value="stop">{t("steps.onError.stop")}</SelectItem>
                      <SelectItem value="retry">{t("steps.onError.retry")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Retry count */}
                {step.on_error === "retry" && (
                  <div className="space-y-2">
                    <Label>{t("steps.fields.retries")}</Label>
                    <Input
                      type="number"
                      value={step.retry_count}
                      onChange={(e) => updateStep(step.id, { retry_count: parseInt(e.target.value) || 0 })}
                      min={1}
                      max={10}
                    />
                  </div>
                )}

                {/* Capture Output */}
                {step.step_type === "command" && (
                  <div className="flex items-center justify-between col-span-2">
                    <div>
                      <Label>{t("steps.fields.captureOutput")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("steps.fields.captureOutputDesc")}
                      </p>
                    </div>
                    <Switch
                      checked={step.capture_output}
                      onCheckedChange={(checked) => updateStep(step.id, { capture_output: checked })}
                    />
                  </div>
                )}

                {/* Enabled */}
                <div className="flex items-center justify-between col-span-2">
                  <div>
                    <Label>{t("steps.fields.enabled")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("steps.fields.enabledDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={step.enabled}
                    onCheckedChange={(checked) => updateStep(step.id, { enabled: checked })}
                  />
                </div>

                {/* Description */}
                <div className="col-span-2 space-y-2">
                  <Label>{t("steps.fields.description")}</Label>
                  <Textarea
                    value={step.description || ""}
                    onChange={(e) => updateStep(step.id, { description: e.target.value })}
                    placeholder={t("steps.fields.descriptionPlaceholder")}
                    rows={2}
                  />
                </div>
              </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("steps.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("steps.subtitle")}
          </p>
        </div>
      </div>

      {/* Add step buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(stepTypeConfig) as Array<keyof typeof stepTypeConfig>).map((type) => {
          const config = stepTypeConfig[type];
          const Icon = config.icon;
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              type="button"
              onClick={() => addStep(type)}
              className={config.color}
            >
              <Icon className="h-4 w-4 mr-1" />
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {t("steps.none")}
              </p>
            </CardContent>
          </Card>
        ) : (
          steps
            .sort((a, b) => a.step_order - b.step_order)
            .map((step) => renderStepContent(step))
        )}
      </div>

    </div>
  );
};

export default TemplateStepEditor;
