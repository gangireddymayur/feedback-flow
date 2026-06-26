import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Star,
  Smile,
  ListChecks,
  CheckCircle2,
  Type,
  AlignLeft,
  ToggleLeft,
  Hash,
  Trash2,
  Copy,
  Eye,
  Save,
  Sparkles,
  Contact,
} from "lucide-react";
import { DashboardLayout, PageHeader, GlassCard } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { QUESTION_LIBRARY, type BuilderQuestion, type QuestionType } from "@/lib/mock-data";
import { Templates } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const builderSearchSchema = z.object({
  templateId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/templates/builder")({
  component: BuilderPage,
  validateSearch: (search) => builderSearchSchema.parse(search),
});

const ICONS: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
  rating: Star,
  nps: Hash,
  emoji: Smile,
  yes_no: ToggleLeft,
  single_choice: CheckCircle2,
  multiple_choice: ListChecks,
  short_text: Type,
  long_text: AlignLeft,
  customer_info: Contact,
};

function makeQuestion(type: QuestionType): BuilderQuestion {
  const def = QUESTION_LIBRARY.find((q) => q.type === type)!;
  const base: BuilderQuestion = {
    id: `q_${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: def.label + "?",
    required: false,
    width: "full",
  };
  if (type === "single_choice" || type === "multiple_choice") {
    base.options = ["Option 1", "Option 2", "Option 3"];
  } else if (type === "rating") {
    base.starLabels = ["", "", "", "", ""];
  } else if (type === "emoji") {
    base.emojis = [
      { emoji: "😡", label: "Very Unsatisfied" },
      { emoji: "😕", label: "Unsatisfied" },
      { emoji: "😐", label: "Neutral" },
      { emoji: "🙂", label: "Satisfied" },
      { emoji: "😍", label: "Extremely Satisfied" },
    ];
  } else if (type === "yes_no") {
    base.yesLabel = "Yes";
    base.noLabel = "No";
  } else if (type === "customer_info") {
    base.label = "Contact Information";
    base.collectName = true;
    base.collectEmail = true;
    base.collectPhone = true;
  }
  return base;
}

function BuilderPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { templateId } = Route.useSearch();

  const [name, setName] = React.useState("Untitled Template");
  const [description, setDescription] = React.useState("");
  const [displayMode, setDisplayMode] = React.useState<"multi_page" | "single_page">("multi_page");
  const [questions, setQuestions] = React.useState<BuilderQuestion[]>([
    makeQuestion("rating"),
    makeQuestion("short_text"),
  ]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<
    { kind: "library"; type: QuestionType } | { kind: "sortable"; id: string } | null
  >(null);

  const { data: existingTemplate } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => (templateId ? Templates.get(templateId) : null),
    enabled: !!templateId,
  });

  React.useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setDescription(existingTemplate.description || "");
      setDisplayMode(
        (existingTemplate.displayMode as "multi_page" | "single_page") || "multi_page",
      );
      const mappedQs = (existingTemplate.questions || []).map((q) => ({
        id: q.id,
        type: q.type as QuestionType,
        label: q.label,
        required: q.required,
        options: q.options,
        width: q.width as "full" | "half",
        starLabels: q.starLabels,
        emojis: q.emojis,
        yesLabel: q.yesLabel,
        noLabel: q.noLabel,
        collectName: q.collectName !== false,
        collectEmail: q.collectEmail !== false,
        collectPhone: q.collectPhone !== false,
      }));
      setQuestions(mappedQs);
      setSelectedId(mappedQs[0]?.id ?? null);
    }
  }, [existingTemplate]);

  React.useEffect(() => {
    if (questions.length > 0 && !selectedId) {
      setSelectedId(questions[0].id);
    }
  }, [questions, selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { kind: "library"; type: QuestionType }
      | { kind: "sortable"; id: string }
      | undefined;
    if (data) setActiveDrag(data);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current as { kind?: string; type?: QuestionType } | undefined;

    if (aData?.kind === "library" && aData.type) {
      const newQ = makeQuestion(aData.type);
      setQuestions((qs) => {
        if (over.id === "canvas") return [...qs, newQ];
        const overIdx = qs.findIndex((q) => q.id === over.id);
        if (overIdx === -1) return [...qs, newQ];
        const next = [...qs];
        next.splice(overIdx + 1, 0, newQ);
        return next;
      });
      setSelectedId(newQ.id);
      return;
    }

    if (aData?.kind === "sortable" && active.id !== over.id) {
      setQuestions((qs) => {
        const from = qs.findIndex((q) => q.id === active.id);
        const to = qs.findIndex((q) => q.id === over.id);
        if (from === -1 || to === -1) return qs;
        return arrayMove(qs, from, to);
      });
    }
  }

  const selected = questions.find((q) => q.id === selectedId) ?? null;

  function updateSelected(patch: Partial<BuilderQuestion>) {
    if (!selected) return;
    setQuestions((qs) => qs.map((q) => (q.id === selected.id ? { ...q, ...patch } : q)));
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateQuestion(id: string) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      if (i === -1) return qs;
      const copy: BuilderQuestion = {
        ...qs[i],
        id: `q_${Math.random().toString(36).slice(2, 9)}`,
      };
      const next = [...qs];
      next.splice(i + 1, 0, copy);
      return next;
    });
  }

  const [saving, setSaving] = React.useState(false);
  async function save(publish = false) {
    setSaving(true);
    try {
      if (templateId) {
        await Templates.update(templateId, {
          name,
          description,
          category: existingTemplate?.category || "General",
          status: publish ? "active" : existingTemplate?.status || "draft",
          displayMode,
          questions,
        });
        toast.success(publish ? "Template published" : "Template updated");
      } else {
        await Templates.create({
          name,
          description,
          category: "General",
          status: publish ? "active" : "draft",
          displayMode,
          questions,
        });
        toast.success(publish ? "Template published" : "Template saved as draft");
      }
      qc.invalidateQueries({ queryKey: ["templates"] });
      router.navigate({ to: "/templates" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const hasCustomerInfo = questions.some((q) => q.type === "customer_info");

  const toggleCustomerInfo = (checked: boolean) => {
    if (checked) {
      const newQ = makeQuestion("customer_info");
      setQuestions((qs) => [...qs, newQ]);
      setSelectedId(newQ.id);
    } else {
      setQuestions((qs) => qs.filter((q) => q.type !== "customer_info"));
      if (selected?.type === "customer_info") setSelectedId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={templateId ? "Edit Template" : "Template Builder"}
        description={
          templateId
            ? "Modify layout, questions, and customize tablet response screens."
            : "Drag question types from the library, drop into the canvas, edit on the right."
        }
        actions={
          <>
            <Button variant="outline" className="bg-white/5 border-white/10" asChild>
              <Link to="/templates">
                <ArrowLeft className="size-4" /> Back
              </Link>
            </Button>
            <Button
              variant="outline"
              className="bg-white/5 border-white/10"
              disabled={saving}
              onClick={() => save(false)}
            >
              <Save className="size-4" /> {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button disabled={saving} onClick={() => save(true)}>
              <Sparkles className="size-4" /> {saving ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-12 gap-4">
          {/* Question Library */}
          <GlassCard className="col-span-12 lg:col-span-3 p-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Question Library
              </div>
              <div className="space-y-2">
                {QUESTION_LIBRARY.map((q) => (
                  <LibraryItem key={q.type} type={q.type} label={q.label} hint={q.hint} />
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 space-y-2.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quick Configurations
              </div>
              <div className="flex items-center justify-between rounded bg-white/5 px-2 py-2">
                <div>
                  <Label
                    htmlFor="t-custinfo"
                    className="text-xs font-semibold text-foreground cursor-pointer"
                  >
                    Collect Customer Info
                  </Label>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Collect name, email, phone
                  </p>
                </div>
                <Switch
                  id="t-custinfo"
                  checked={hasCustomerInfo}
                  onCheckedChange={toggleCustomerInfo}
                  className="scale-75 cursor-pointer"
                />
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground border-t border-white/5 pt-3">
              Drag a card into the canvas, or click <Plus className="inline size-3 -mt-0.5" /> on
              any item to append.
            </div>
          </GlassCard>

          {/* Canvas */}
          <div className="col-span-12 lg:col-span-6 space-y-4">
            <GlassCard className="p-5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Template name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-transparent border-0 px-0 text-2xl font-semibold focus-visible:ring-0 h-auto mt-1"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown to customers…"
                className="bg-white/5 border-white/10 mt-2 min-h-16 resize-none"
              />

              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Display Mode</Label>
                  <p className="text-[10px] text-muted-foreground">
                    How questions render on the tablet screen
                  </p>
                </div>
                <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                  <Button
                    variant={displayMode === "multi_page" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDisplayMode("multi_page")}
                    className="h-7 text-[10px] px-2 py-0"
                  >
                    Multi Page
                  </Button>
                  <Button
                    variant={displayMode === "single_page" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setDisplayMode("single_page")}
                    className="h-7 text-[10px] px-2 py-0"
                  >
                    Single Page
                  </Button>
                </div>
              </div>
            </GlassCard>

            <Canvas
              questions={questions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={removeQuestion}
              onDuplicate={duplicateQuestion}
            />
          </div>

          {/* Inspector */}
          <GlassCard className="col-span-12 lg:col-span-3 p-4 h-fit lg:sticky lg:top-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Eye className="size-3.5" /> Inspector
            </div>
            {selected ? (
              <Inspector q={selected} onChange={updateSelected} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a question to edit its label, options, layout, and customized fields.
              </p>
            )}
          </GlassCard>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === "library" && (
            <div className="glass-strong rounded-xl px-3 py-2.5 text-sm shadow-2xl border border-primary/30 inline-flex items-center gap-2">
              <GripVertical className="size-3.5 text-muted-foreground" />
              {QUESTION_LIBRARY.find((q) => q.type === activeDrag.type)?.label}
            </div>
          )}
          {activeDrag?.kind === "sortable" && (
            <div className="glass-strong rounded-xl p-3 shadow-2xl border border-primary/30 text-sm">
              Moving…
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </DashboardLayout>
  );
}

function LibraryItem({ type, label, hint }: { type: QuestionType; label: string; hint: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `lib_${type}`,
    data: { kind: "library", type },
  });
  const Icon = ICONS[type];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing border border-white/5",
        isDragging && "opacity-40",
      )}
    >
      <div className="size-7 rounded-lg bg-primary/10 grid place-items-center text-primary">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{hint}</div>
      </div>
      <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

function Canvas({
  questions,
  selectedId,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  questions: BuilderQuestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass rounded-2xl p-4 min-h-[360px] transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-2">
        Canvas · {questions.length} question{questions.length === 1 ? "" : "s"}
      </div>
      {questions.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-xl h-64 grid place-items-center text-sm text-muted-foreground">
          Drag a question from the left to start.
        </div>
      ) : (
        <SortableContext items={questions.map((q) => q.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3">
            {questions.map((q, i) => (
              <SortableQuestion
                key={q.id}
                q={q}
                index={i}
                selected={selectedId === q.id}
                onSelect={() => onSelect(q.id)}
                onRemove={() => onRemove(q.id)}
                onDuplicate={() => onDuplicate(q.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function SortableQuestion({
  q,
  index,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  q: BuilderQuestion;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
    data: { kind: "sortable", id: q.id },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = ICONS[q.type];
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group rounded-xl border bg-white/[0.03] p-3 flex items-start gap-3 transition-colors cursor-pointer",
        selected
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-white/5 hover:border-white/10 hover:bg-white/[0.06]",
        isDragging && "opacity-50",
        q.width === "half" ? "col-span-2 md:col-span-1" : "col-span-2",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="size-7 rounded-md grid place-items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Drag"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="size-8 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Q{index + 1}</span>
          {q.required && (
            <Badge
              variant="secondary"
              className="bg-rose-400/15 text-rose-300 text-[9px] px-1.5 py-0"
            >
              Required
            </Badge>
          )}
          {q.width === "half" && (
            <Badge
              variant="outline"
              className="border-white/10 text-muted-foreground text-[9px] px-1.5 py-0"
            >
              50% Width
            </Badge>
          )}
        </div>
        <div className="font-medium text-sm mt-0.5 truncate">{q.label}</div>
        <QuestionPreview q={q} />
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-rose-300 hover:text-rose-200"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function QuestionPreview({ q }: { q: BuilderQuestion }) {
  switch (q.type) {
    case "rating":
      return (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 text-muted-foreground/40" />
            ))}
          </div>
          {q.starLabels?.some((l) => l) && (
            <div className="flex justify-between w-full text-[8px] text-muted-foreground px-0.5">
              <span>{q.starLabels[0] || "1"}</span>
              <span>{q.starLabels[4] || "5"}</span>
            </div>
          )}
        </div>
      );
    case "nps":
      return (
        <div className="flex gap-0.5 mt-2 flex-wrap">
          {Array.from({ length: 11 }).map((_, i) => (
            <span
              key={i}
              className="text-[9px] size-4.5 grid place-items-center rounded bg-white/5 text-muted-foreground"
            >
              {i}
            </span>
          ))}
        </div>
      );
    case "emoji": {
      const emojiList = q.emojis || [
        { emoji: "😡", label: "Very Unsatisfied" },
        { emoji: "😕", label: "Unsatisfied" },
        { emoji: "😐", label: "Neutral" },
        { emoji: "🙂", label: "Satisfied" },
        { emoji: "😍", label: "Extremely Satisfied" },
      ];
      return (
        <div className="flex flex-wrap gap-1 mt-2 text-xs text-muted-foreground select-none">
          {emojiList.map((item, idx) => (
            <span
              key={idx}
              className="bg-white/5 px-1 py-0.5 rounded border border-white/5"
              title={item.label}
            >
              {item.emoji}
            </span>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="flex gap-1.5 mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground font-medium">
            {q.yesLabel || "Yes"}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground font-medium">
            {q.noLabel || "No"}
          </span>
        </div>
      );
    case "single_choice":
    case "multiple_choice":
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(q.options ?? []).map((o, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-muted-foreground"
            >
              {o}
            </span>
          ))}
        </div>
      );
    case "short_text":
      return <div className="mt-2 h-6 rounded bg-white/5 border border-white/5" />;
    case "long_text":
      return <div className="mt-2 h-10 rounded bg-white/5 border border-white/5" />;
    case "customer_info": {
      const fields = [];
      if (q.collectName !== false) fields.push("Name");
      if (q.collectEmail !== false) fields.push("Email");
      if (q.collectPhone !== false) fields.push("Phone");
      return (
        <div className="flex flex-wrap gap-1 mt-2">
          {fields.map((f) => (
            <span
              key={f}
              className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded"
            >
              {f} input
            </span>
          ))}
          {fields.length === 0 && (
            <span className="text-[9px] italic text-rose-300">No fields selected</span>
          )}
        </div>
      );
    }
  }
}

function Inspector({
  q,
  onChange,
}: {
  q: BuilderQuestion;
  onChange: (patch: Partial<BuilderQuestion>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Question label
        </Label>
        <Input
          value={q.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="bg-white/5 border-white/10 mt-1.5"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <Label htmlFor="req" className="text-xs cursor-pointer">
          Required
        </Label>
        <Switch
          id="req"
          checked={q.required}
          onCheckedChange={(v) => onChange({ required: v })}
          className="scale-90 cursor-pointer"
        />
      </div>

      {/* Grid Width layout switch */}
      <div className="space-y-1.5 border-t border-white/5 pt-3">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Layout Width
        </Label>
        <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
          <Button
            variant={q.width === "half" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange({ width: "half" })}
            className="w-full h-7 text-[10px] px-0"
          >
            Half (50%)
          </Button>
          <Button
            variant={q.width !== "half" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange({ width: "full" })}
            className="w-full h-7 text-[10px] px-0"
          >
            Full (100%)
          </Button>
        </div>
      </div>

      {/* Yes/No customizable text */}
      {q.type === "yes_no" && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Custom Button Labels
          </Label>
          <div>
            <Label className="text-[10px] text-muted-foreground">Yes button text</Label>
            <Input
              value={q.yesLabel || "Yes"}
              onChange={(e) => onChange({ yesLabel: e.target.value })}
              className="bg-white/5 border-white/10 mt-1 text-xs h-8"
              placeholder="Yes"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">No button text</Label>
            <Input
              value={q.noLabel || "No"}
              onChange={(e) => onChange({ noLabel: e.target.value })}
              className="bg-white/5 border-white/10 mt-1 text-xs h-8"
              placeholder="No"
            />
          </div>
        </div>
      )}

      {/* Star Rating Label configurator */}
      {q.type === "rating" && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Star Labels
          </Label>
          <p className="text-[9px] text-muted-foreground -mt-1">
            Labels displayed underneath rating options
          </p>
          {Array.from({ length: 5 }).map((_, i) => {
            const currentLabels = q.starLabels || ["", "", "", "", ""];
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                  {i + 1} Star:
                </span>
                <Input
                  value={currentLabels[i] || ""}
                  onChange={(e) => {
                    const next = [...currentLabels];
                    next[i] = e.target.value;
                    onChange({ starLabels: next });
                  }}
                  className="bg-white/5 border-white/10 h-7 text-xs"
                  placeholder={`Label for star ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Emoji list builder */}
      {q.type === "emoji" && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Emoji options
            </Label>
            <Button
              variant="outline"
              size="xs"
              className="text-[9px] bg-white/5 border-white/10 h-6 px-1.5"
              onClick={() => {
                const currentEmojis = q.emojis || [
                  { emoji: "😡", label: "Very Unsatisfied" },
                  { emoji: "😕", label: "Unsatisfied" },
                  { emoji: "😐", label: "Neutral" },
                  { emoji: "🙂", label: "Satisfied" },
                  { emoji: "😍", label: "Extremely Satisfied" },
                ];
                onChange({
                  emojis: [...currentEmojis, { emoji: "😀", label: "Happy" }],
                });
              }}
            >
              + Add
            </Button>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {(
              q.emojis || [
                { emoji: "😡", label: "Very Unsatisfied" },
                { emoji: "😕", label: "Unsatisfied" },
                { emoji: "😐", label: "Neutral" },
                { emoji: "🙂", label: "Satisfied" },
                { emoji: "😍", label: "Extremely Satisfied" },
              ]
            ).map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <Input
                  value={item.emoji}
                  onChange={(e) => {
                    const next = [...(q.emojis || [])];
                    if (next[idx]) next[idx] = { ...next[idx], emoji: e.target.value };
                    onChange({ emojis: next });
                  }}
                  className="bg-white/5 border-white/10 h-7 w-10 text-center text-xs shrink-0"
                  placeholder="😀"
                />
                <Input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...(q.emojis || [])];
                    if (next[idx]) next[idx] = { ...next[idx], label: e.target.value };
                    onChange({ emojis: next });
                  }}
                  className="bg-white/5 border-white/10 h-7 text-xs"
                  placeholder="Label"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-rose-300"
                  onClick={() => {
                    const current = q.emojis || [
                      { emoji: "😡", label: "Very Unsatisfied" },
                      { emoji: "😕", label: "Unsatisfied" },
                      { emoji: "😐", label: "Neutral" },
                      { emoji: "🙂", label: "Satisfied" },
                      { emoji: "😍", label: "Extremely Satisfied" },
                    ];
                    onChange({ emojis: current.filter((_, j) => j !== idx) });
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Info Form field checkboxes */}
      {q.type === "customer_info" && (
        <div className="space-y-3 border-t border-white/5 pt-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Fields to Display
          </Label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-name" className="text-xs cursor-pointer">
                Collect Full Name
              </Label>
              <Switch
                id="ci-name"
                checked={q.collectName !== false}
                onCheckedChange={(checked) => onChange({ collectName: checked })}
                className="scale-75 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-email" className="text-xs cursor-pointer">
                Collect Email Address
              </Label>
              <Switch
                id="ci-email"
                checked={q.collectEmail !== false}
                onCheckedChange={(checked) => onChange({ collectEmail: checked })}
                className="scale-75 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-phone" className="text-xs cursor-pointer">
                Collect Phone Number
              </Label>
              <Switch
                id="ci-phone"
                checked={q.collectPhone !== false}
                onCheckedChange={(checked) => onChange({ collectPhone: checked })}
                className="scale-75 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {(q.type === "single_choice" || q.type === "multiple_choice") && (
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Options
          </Label>
          <div className="space-y-1.5 mt-1.5">
            {(q.options ?? []).map((opt, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...(q.options ?? [])];
                    next[i] = e.target.value;
                    onChange({ options: next });
                  }}
                  className="bg-white/5 border-white/10"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-rose-300"
                  onClick={() => onChange({ options: (q.options ?? []).filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white/5 border-white/10"
              onClick={() =>
                onChange({
                  options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`],
                })
              }
            >
              <Plus className="size-3.5" /> Add option
            </Button>
          </div>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground border-t border-white/5 pt-3">
        Type: <span className="text-foreground capitalize">{q.type.replace("_", " ")}</span>
      </div>
    </div>
  );
}
