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
  Palette,
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QUESTION_LIBRARY, type BuilderQuestion, type QuestionType } from "@/lib/mock-data";
import { Templates } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const builderSearchSchema = z.object({
  templateId: z.coerce.number().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});

const ALL_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕",
  "👍", "👎", "✊", "👊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "👐", "🙌", "👏", "🙏", "🤝", "✍️", "💪", "🧠", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "🔥", "✨", "🌟", "⭐", "🎉", "🎈", "🎁", "💡", "⚡", "💥", "🌈", "☀️"
];

function EmojiPicker({ onSelect, children }: { onSelect: (emoji: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-zinc-950 border-zinc-800 text-foreground z-[9999]">
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1 select-none">Select Emoji</div>
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto pr-1">
          {ALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(emoji);
                setOpen(false);
              }}
              className="text-lg p-1 hover:bg-white/10 rounded cursor-pointer transition-colors text-center select-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

function makeQuestion(type: QuestionType, page = 1): BuilderQuestion {
  const def = QUESTION_LIBRARY.find((q) => q.type === type)!;
  const base: BuilderQuestion = {
    id: `q_${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: def.label + "?",
    required: false,
    width: "full",
    page,
  };
  if (type === "single_choice" || type === "multiple_choice") {
    base.options = ["Option 1", "Option 2", "Option 3"];
  } else if (type === "rating") {
    base.maxStars = 5;
    base.starLabels = Array(10).fill("");
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
  const [previewQuestionType, setPreviewQuestionType] = React.useState<QuestionType | null>(null);
  const [showTabletPreview, setShowTabletPreview] = React.useState(false);
  const qc = useQueryClient();
  const { templateId, name: qName, description: qDesc, category: qCat } = Route.useSearch();

  const [name, setName] = React.useState(qName || "Untitled Template");
  const [description, setDescription] = React.useState(qDesc || "");
  const [displayMode, setDisplayMode] = React.useState<"multi_page" | "single_page">("multi_page");

  const [activePage, setActivePage] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);

  const [branding, setBranding] = React.useState<{
    enabled: boolean;
    companyName: string;
    logoUrl: string;
    position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    size: number;
    offsetX: number;
    offsetY: number;
    brandColor?: string;
    fontFamily?: string;
    backgroundStyle?: "solid" | "gradient" | "default";
    themeMode?: "light" | "dark";
    fontSize?: "normal" | "large" | "xlarge";
    textColor?: string;
  }>({
    enabled: false,
    companyName: "",
    logoUrl: "",
    position: "top_right",
    size: 100,
    offsetX: 16,
    offsetY: 16,
    brandColor: "#0F766E",
    fontFamily: "Inter",
    backgroundStyle: "default",
    themeMode: "dark",
    fontSize: "normal",
    textColor: "",
  });

  const defaultQuestions = React.useMemo(() => [
    makeQuestion("rating", 1),
    makeQuestion("short_text", 1),
  ], []);

  const [questions, setQuestions] = React.useState<BuilderQuestion[]>(defaultQuestions);
  const [selectedId, setSelectedId] = React.useState<string | null>(defaultQuestions[0].id);
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
      setDisplayMode((existingTemplate.displayMode as "multi_page" | "single_page") || "multi_page");
      if (existingTemplate.branding) {
        setBranding({
          enabled: !!existingTemplate.branding.enabled,
          companyName: existingTemplate.branding.companyName || "",
          logoUrl: existingTemplate.branding.logoUrl || "",
          position: existingTemplate.branding.position || "top_right",
          size: existingTemplate.branding.size || 100,
          offsetX: existingTemplate.branding.offsetX ?? 16,
          offsetY: existingTemplate.branding.offsetY ?? 16,
          brandColor: existingTemplate.branding.brandColor || "#0F766E",
          fontFamily: existingTemplate.branding.fontFamily || "Inter",
          backgroundStyle: existingTemplate.branding.backgroundStyle || "default",
          themeMode: existingTemplate.branding.themeMode || "dark",
          fontSize: (existingTemplate.branding as any)?.fontSize || "normal",
          textColor: (existingTemplate.branding as any)?.textColor || "",
        });
      } else {
        setBranding({
          enabled: false,
          companyName: "",
          logoUrl: "",
          position: "top_right",
          size: 100,
          offsetX: 16,
          offsetY: 16,
          brandColor: "#0F766E",
          fontFamily: "Inter",
          backgroundStyle: "default",
          themeMode: "dark",
          fontSize: "normal",
          textColor: "",
        });
      }
      const mappedQs = (existingTemplate.questions || []).map((q) => ({
        id: q.id,
        type: q.type as QuestionType,
        label: q.label,
        required: q.required,
        options: q.options,
        width: q.width as "full" | "half",
        maxStars: q.maxStars || 5,
        starLabels: q.starLabels || Array(10).fill(""),
        emojis: q.emojis,
        yesLabel: q.yesLabel,
        noLabel: q.noLabel,
        collectName: q.collectName !== false,
        collectEmail: q.collectEmail !== false,
        collectPhone: q.collectPhone !== false,
        page: (q as { page?: number }).page || 1,
      }));
      setQuestions(mappedQs);
      setSelectedId(mappedQs[0]?.id ?? null);
      const maxPage = Math.max(1, ...mappedQs.map((q) => q.page || 1));
      setTotalPages(maxPage);
      setActivePage(1);
    }
  }, [existingTemplate]);

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
      const newQ = makeQuestion(aData.type, activePage);
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

  // Track active page when selecting a question (e.g. sync selected question's page)
  React.useEffect(() => {
    if (selected && selected.page && selected.page !== activePage) {
      setActivePage(selected.page);
    }
  }, [selectedId]);

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
        page: qs[i].page || activePage,
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
          status: publish ? "active" : (existingTemplate?.status || "draft"),
          displayMode,
          questions,
          branding,
        });
        toast.success(publish ? "Template published" : "Template updated");
      } else {
        await Templates.create({
          name,
          description,
          category: qCat || "General",
          status: publish ? "active" : "draft",
          displayMode,
          questions,
          branding,
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
      const newQ = makeQuestion("customer_info", activePage);
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
        description={templateId ? "Modify layout, questions, and customize tablet response screens." : "Drag question types from the library, drop into the canvas, edit on the right."}
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
            <Button
              variant="outline"
              className="bg-white/5 border-white/10 hover:bg-white/10"
              onClick={() => setShowTabletPreview(true)}
            >
              <Eye className="size-4" /> Preview
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
                  <LibraryItem
                    key={q.type}
                    type={q.type}
                    label={q.label}
                    hint={q.hint}
                    onPreviewClick={() => setPreviewQuestionType(q.type)}
                  />
                ))}
              </div>
            </div>
            
            <div className="border-t border-white/5 pt-3 space-y-2.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quick Configurations
              </div>
              <div className="flex items-center justify-between rounded bg-white/5 px-2 py-2">
                <div>
                  <Label htmlFor="t-custinfo" className="text-xs font-semibold text-foreground cursor-pointer">
                    Collect Customer Info
                  </Label>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Collect name, email, phone</p>
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
                  <p className="text-[10px] text-muted-foreground">How questions render on the tablet screen</p>
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
              setQuestions={setQuestions}
              activePage={activePage}
              setActivePage={setActivePage}
              totalPages={totalPages}
              setTotalPages={setTotalPages}
              displayMode={displayMode}
              branding={branding}
            />
          </div>
 
          {/* Inspector */}
          <GlassCard className="col-span-12 lg:col-span-3 p-4 h-fit lg:sticky lg:top-6 space-y-6">
            {selected && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2 pb-2 border-b border-white/5">
                  <Eye className="size-3.5" /> Question Properties
                </div>
                <Inspector q={selected} onChange={updateSelected} />
                <div className="border-t border-white/10 my-6" />
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2 pb-2 border-b border-white/5">
                <Palette className="size-3.5 text-teal-400" /> Template Settings & Branding
              </div>
              <BrandingInspector branding={branding} onChange={setBranding} />
            </div>
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

      <Dialog open={previewQuestionType !== null} onOpenChange={(open) => !open && setPreviewQuestionType(null)}>
        <DialogContent className="glass-strong border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              {previewQuestionType && React.createElement(ICONS[previewQuestionType], { className: "size-5 text-primary" })}
              {previewQuestionType && QUESTION_LIBRARY.find(q => q.type === previewQuestionType)?.label} Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {previewQuestionType && QUESTION_LIBRARY.find(q => q.type === previewQuestionType)?.hint}
            </DialogDescription>
          </DialogHeader>

          {/* Render Mock Preview of the Question Type */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-6 my-2 flex flex-col items-center justify-center min-h-[160px]">
            {previewQuestionType === "rating" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">How would you rate our service?</div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} className="size-8 text-amber-400 fill-amber-400 cursor-pointer" />
                  ))}
                </div>
              </div>
            )}
            {previewQuestionType === "nps" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">How likely are you to recommend us?</div>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="size-8 rounded-lg border border-white/10 flex items-center justify-center text-xs font-semibold bg-white/5 hover:bg-primary/20 cursor-pointer">
                      {i}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewQuestionType === "emoji" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">How do you feel about today's visit?</div>
                <div className="flex justify-center gap-3">
                  {["😡", "😐", "🙂", "😍"].map(emoji => (
                    <div key={emoji} className="text-3xl hover:scale-110 cursor-pointer transition-transform">
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewQuestionType === "yes_no" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">Did you find everything you were looking for?</div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" className="w-24 bg-white/5 border-white/10">Yes</Button>
                  <Button variant="outline" className="w-24 bg-white/5 border-white/10">No</Button>
                </div>
              </div>
            )}
            {previewQuestionType === "single_choice" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">Which service did you use today?</div>
                <div className="space-y-2 max-w-xs mx-auto">
                  {["Dine In", "Takeaway", "Home Delivery"].map(opt => (
                    <div key={opt} className="px-3 py-2 text-left rounded-lg bg-white/5 border border-white/10 text-xs cursor-pointer hover:bg-white/10">
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewQuestionType === "multiple_choice" && (
              <div className="space-y-4 text-center w-full">
                <div className="text-sm font-medium">Select areas we did well:</div>
                <div className="space-y-2 max-w-xs mx-auto">
                  {["Speed of service", "Staff friendliness", "Cleanliness", "Product quality"].map(opt => (
                    <div key={opt} className="px-3 py-2 text-left rounded-lg bg-white/5 border border-white/10 text-xs flex items-center gap-2 cursor-pointer hover:bg-white/10">
                      <div className="size-4 rounded border border-white/20 flex items-center justify-center" />
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewQuestionType === "short_text" && (
              <div className="space-y-4 text-center w-full max-w-xs">
                <div className="text-sm font-medium">Any specific comments?</div>
                <Input placeholder="Type your comment..." className="bg-white/5 border-white/10 text-xs" readOnly />
              </div>
            )}
            {previewQuestionType === "long_text" && (
              <div className="space-y-4 text-center w-full max-w-xs">
                <div className="text-sm font-medium">Share your experience in detail:</div>
                <Textarea placeholder="Type detailed response..." className="bg-white/5 border-white/10 text-xs" readOnly />
              </div>
            )}
            {previewQuestionType === "customer_info" && (
              <div className="space-y-3 w-full max-w-xs mx-auto">
                <div className="text-center text-sm font-medium">Contact Details</div>
                <Input placeholder="Full Name" className="bg-white/5 border-white/10 text-xs h-8" readOnly />
                <Input placeholder="Email Address" className="bg-white/5 border-white/10 text-xs h-8" readOnly />
                <Input placeholder="Phone Number" className="bg-white/5 border-white/10 text-xs h-8" readOnly />
              </div>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground mt-2">
            💡 Drag this question type into your template or click the "+" button in the library list to customize it.
          </div>
        </DialogContent>
      </Dialog>

      <SurveyTabletPreview
        open={showTabletPreview}
        onClose={() => setShowTabletPreview(false)}
        name={name}
        questions={questions}
        displayMode={displayMode}
        branding={branding}
      />
    </DashboardLayout>
  );
}

function LibraryItem({
  type,
  label,
  hint,
  onPreviewClick,
}: {
  type: QuestionType;
  label: string;
  hint: string;
  onPreviewClick: () => void;
}) {
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
        "flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing border border-white/5 group",
        isDragging && "opacity-40",
      )}
    >
      <div className="size-7 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate leading-tight">{label}</div>
        <div className="text-[9px] text-muted-foreground truncate leading-tight">{hint}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onPreviewClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="size-7 rounded-lg hover:bg-white/10 grid place-items-center text-muted-foreground hover:text-white transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <Eye className="size-3.5" />
      </button>
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
  setQuestions,
  activePage,
  setActivePage,
  totalPages,
  setTotalPages,
  displayMode,
  branding,
}: {
  questions: BuilderQuestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  setQuestions: React.Dispatch<React.SetStateAction<BuilderQuestion[]>>;
  activePage: number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  setTotalPages: React.Dispatch<React.SetStateAction<number>>;
  displayMode: "multi_page" | "single_page";
  branding: {
    enabled: boolean;
    companyName: string;
    logoUrl: string;
    position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    size: number;
    offsetX: number;
    offsetY: number;
    brandColor?: string;
    fontFamily?: string;
    backgroundStyle?: "solid" | "gradient";
    themeMode?: "light" | "dark";
    fontSize?: string;
    textColor?: string;
  };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  const pageQuestions = displayMode === "multi_page"
    ? questions.filter((q) => (q.page || 1) === activePage)
    : questions;

  const canvasBgStyle = React.useMemo(() => {
    if (branding.backgroundStyle === "solid") {
      return { background: branding.brandColor || "#0F766E" };
    } else if (branding.backgroundStyle === "gradient") {
      const baseColor = branding.brandColor || "#0F766E";
      return {
        background: `linear-gradient(135deg, ${baseColor} 0%, rgba(24, 24, 27, 0.9) 100%)`,
      };
    } else {
      return branding.themeMode === "light"
        ? { background: "#F8FAFC" }
        : { background: "#0b0f19" };
    }
  }, [branding.backgroundStyle, branding.brandColor, branding.themeMode]);

  return (
    <div
      ref={setNodeRef}
      style={{ ...canvasBgStyle, fontFamily: branding.fontFamily || "Inter", color: branding.themeMode === "light" ? "#18181b" : "#ffffff" }}
      className={cn(
        "glass rounded-2xl p-4 min-h-[360px] transition-all duration-300 relative",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-2 flex items-center justify-between">
        <span>
          Canvas · {pageQuestions.length} question{pageQuestions.length === 1 ? "" : "s"}
          {displayMode === "multi_page" && ` on Page ${activePage}`}
        </span>
        <span className="text-[9px] text-muted-foreground capitalize">
          Mode: {displayMode.replace("_", " ")}
        </span>
      </div>
      {pageQuestions.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-xl h-64 grid place-items-center text-sm text-muted-foreground">
          {displayMode === "multi_page"
            ? `Page ${activePage} is empty. Drag a question from the left to start adding here.`
            : "Drag a question from the left to start."}
        </div>
      ) : (
        <SortableContext items={pageQuestions.map((q) => q.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3">
            {pageQuestions.map((q) => (
              <SortableQuestion
                key={q.id}
                q={q}
                index={questions.indexOf(q)}
                selected={selectedId === q.id}
                onSelect={() => onSelect(q.id)}
                onRemove={() => onRemove(q.id)}
                onDuplicate={() => onDuplicate(q.id)}
                onToggleWidth={() => {
                  setQuestions((qs) => qs.map((x) => x.id === q.id ? { ...x, width: x.width === "half" ? "full" : "half" } : x));
                }}
                themeMode={branding.themeMode || "dark"}
                brandColor={branding.brandColor || "#0F766E"}
                fontSize={branding.fontSize}
                textColor={branding.textColor}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {displayMode === "multi_page" && (
        <div className="mt-6 border-t border-white/5 pt-4 flex flex-wrap items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">Pages:</span>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <div key={pNum} className="flex items-center gap-0.5">
                  <Button
                    size="sm"
                    variant={activePage === pNum ? "secondary" : "outline"}
                    className={cn(
                      "h-8 px-3 text-xs cursor-pointer font-semibold",
                      activePage === pNum ? "bg-primary text-primary-foreground border-primary/20" : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                    onClick={() => setActivePage(pNum)}
                  >
                    Page {pNum}
                  </Button>
                  {totalPages > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-rose-300 hover:text-rose-400 hover:bg-white/5 cursor-pointer"
                      title={`Delete Page ${pNum}`}
                      onClick={() => {
                        setQuestions((qs) => {
                          return qs
                            .filter((q) => (q.page || 1) !== pNum)
                            .map((q) => {
                              const qp = q.page || 1;
                              if (qp > pNum) {
                                  return { ...q, page: qp - 1 };
                              }
                              return q;
                            });
                        });
                        setTotalPages((prev) => Math.max(1, prev - 1));
                        setActivePage((prev) => {
                          const nextAct = prev === pNum ? Math.max(1, prev - 1) : prev;
                          return nextAct > totalPages - 1 ? Math.max(1, totalPages - 1) : nextAct;
                        });
                        toast.success(`Deleted Page ${pNum}`);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 border-dashed border-white/20 hover:border-white/30 text-emerald-400 font-semibold flex items-center gap-1 cursor-pointer bg-white/[0.02]"
              onClick={() => {
                const nextPages = totalPages + 1;
                setTotalPages(nextPages);
                setActivePage(nextPages);
                toast.success(`Page ${nextPages} created`);
              }}
            >
              <Plus className="size-3.5" /> Add Page
            </Button>
          </div>
          <span className="text-[10px] text-muted-foreground italic">
            Total questions: {questions.length}
          </span>
        </div>
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
  onToggleWidth,
  themeMode = "dark",
  brandColor = "#0F766E",
  fontSize,
  textColor,
}: {
  q: BuilderQuestion;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleWidth: () => void;
  themeMode?: "light" | "dark";
  brandColor?: string;
  fontSize?: string;
  textColor?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
    data: { kind: "sortable", id: q.id },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = ICONS[q.type];
  const isLight = themeMode === "light";
  const customBorderColor = selected ? brandColor : (isLight ? "rgba(228, 228, 231, 1)" : "rgba(255, 255, 255, 0.05)");
  const customBgColor = selected ? `${brandColor}15` : (isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.03)");
  const textTitleColor = isLight ? "text-zinc-900" : "text-white";

  const fontSizePx = React.useMemo(() => {
    if (!fontSize || fontSize === "normal") return 14;
    if (fontSize === "large") return 18;
    if (fontSize === "xlarge") return 22;
    const num = parseInt(fontSize, 10);
    return isNaN(num) ? 14 : Math.min(32, Math.max(12, Math.round(num * 0.45)));
  }, [fontSize]);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: customBorderColor, backgroundColor: customBgColor }}
      onClick={onSelect}
      className={cn(
        "group rounded-xl border p-3 flex items-start gap-3 transition-colors cursor-pointer",
        isLight ? "text-zinc-900 shadow-sm" : "text-white",
        isDragging && "opacity-50",
        q.width === "half" ? "col-span-2 md:col-span-1" : "col-span-2"
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
          <span className={cn("text-[10px]", isLight ? "text-zinc-500" : "text-muted-foreground")}>Q{index + 1}</span>
          {q.required && (
            <Badge
              variant="secondary"
              className={cn("text-[9px] px-1.5 py-0", isLight ? "bg-rose-100 text-rose-700 font-semibold" : "bg-rose-400/15 text-rose-300")}
            >
              Required
            </Badge>
          )}
          {q.width === "half" && (
            <Badge
              variant="outline"
              className={cn("text-[9px] px-1.5 py-0", isLight ? "border-zinc-200 text-zinc-500" : "border-white/10 text-muted-foreground")}
            >
              50% Width
            </Badge>
          )}
        </div>
        <div 
          style={{ fontSize: `${fontSizePx}px`, color: textColor || undefined }} 
          className={cn("font-semibold mt-0.5 truncate transition-all", !textColor && textTitleColor)}
        >
          {q.label}
        </div>
        <QuestionPreview q={q} themeMode={themeMode} />
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWidth();
          }}
          className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded border select-none shrink-0 cursor-pointer",
            isLight 
              ? "border-zinc-200 hover:bg-zinc-100 text-zinc-600" 
              : "border-white/10 hover:bg-white/10 text-muted-foreground"
          )}
          title="Toggle width (50% / 100%)"
        >
          {q.width === "half" ? "50%" : "100%"}
        </button>
        <Button
          size="icon"
          variant="ghost"
          className={cn("size-7", isLight ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100" : "text-muted-foreground hover:text-white")}
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
          className={cn("size-7", isLight ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50" : "text-rose-300 hover:text-rose-200")}
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

function QuestionPreview({ q, themeMode = "dark" }: { q: BuilderQuestion; themeMode?: "light" | "dark" }) {
  const isLight = themeMode === "light";
  const bgClass = isLight ? "bg-zinc-100 text-zinc-700 border-zinc-200" : "bg-white/5 text-muted-foreground border-white/5";
  const textClass = isLight ? "text-zinc-500" : "text-muted-foreground";

  switch (q.type) {
    case "rating": {
      const totalStars = q.maxStars || 5;
      return (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: totalStars }).map((_, i) => (
              <Star key={i} className={cn("size-4", isLight ? "text-zinc-300" : "text-muted-foreground/40")} />
            ))}
          </div>
          {q.starLabels?.some((l) => l) && (
            <div className={cn("flex justify-between w-full text-[8px] px-0.5", textClass)}>
              <span>{q.starLabels[0] || "1"}</span>
              <span>{q.starLabels[totalStars - 1] || totalStars.toString()}</span>
            </div>
          )}
        </div>
      );
    }
    case "nps":
      return (
        <div className="flex gap-0.5 mt-2 flex-wrap">
          {Array.from({ length: 11 }).map((_, i) => (
            <span
              key={i}
              className={cn("text-[9px] size-4.5 grid place-items-center rounded border", bgClass)}
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
        <div className={cn("flex flex-wrap gap-1 mt-2 text-xs select-none", textClass)}>
          {emojiList.map((item, idx) => (
            <span key={idx} className={cn("px-1 py-0.5 rounded border", bgClass)} title={item.label}>
              {item.emoji}
            </span>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="flex gap-1.5 mt-2">
          <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", bgClass)}>
            {q.yesLabel || "Yes"}
          </span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", bgClass)}>
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
              className={cn("text-[10px] px-2 py-0.5 rounded border", bgClass)}
            >
              {o}
            </span>
          ))}
        </div>
      );
    case "short_text":
      return <div className={cn("mt-2 h-6 rounded border", bgClass)} />;
    case "long_text":
      return <div className={cn("mt-2 h-10 rounded border", bgClass)} />;
    case "customer_info": {
      const fields = [];
      if (q.collectName !== false) fields.push("Name");
      if (q.collectEmail !== false) fields.push("Email");
      if (q.collectPhone !== false) fields.push("Phone");
      return (
        <div className="flex flex-wrap gap-1 mt-2">
          {fields.map((f) => (
            <span key={f} className={cn(
              "text-[9px] px-1.5 py-0.5 rounded border",
              isLight 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            )}>
              {f} input
            </span>
          ))}
          {fields.length === 0 && <span className="text-[9px] italic text-rose-500">No fields selected</span>}
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
        <div className="flex gap-1.5 mt-1.5">
          <Input
            value={q.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="bg-white/5 border-white/10 flex-1"
          />
          <EmojiPicker
            onSelect={(emoji) => {
              onChange({ label: q.label + emoji });
            }}
          >
            <Button
              size="icon"
              variant="outline"
              className="size-9 shrink-0 bg-white/5 border-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Insert Emoji"
            >
              <Smile className="size-4" />
            </Button>
          </EmojiPicker>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <Label htmlFor="req" className="text-xs cursor-pointer">
          Required
        </Label>
        <Switch id="req" checked={q.required} onCheckedChange={(v) => onChange({ required: v })} className="scale-90 cursor-pointer" />
      </div>

      {/* Grid Width layout switch */}
      <div className="space-y-1.5 border-t border-white/5 pt-3">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Layout Width</Label>
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
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Custom Button Labels</Label>
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

      {/* Star Rating Max Stars and Label configurator */}
      {q.type === "rating" && (
        <div className="space-y-3 border-t border-white/5 pt-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Number of Stars</Label>
            <div className="flex gap-1 mt-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
              {[3, 5, 10].map((num) => (
                <Button
                  key={num}
                  variant={q.maxStars === num ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    const currentLabels = q.starLabels || [];
                    const nextLabels = currentLabels.length >= num ? currentLabels : [...currentLabels, ...Array(num - currentLabels.length).fill("")];
                    onChange({ maxStars: num, starLabels: nextLabels });
                  }}
                  className="w-full h-7 text-[10px] px-0"
                >
                  {num} Stars
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Star Labels</Label>
            <Button
              variant="outline"
              size="xs"
              className="text-[9px] bg-white/5 border-white/10 h-6 px-1.5 cursor-pointer"
              onClick={() => {
                const currentStars = q.maxStars || 5;
                const nextStars = currentStars + 1;
                const currentLabels = q.starLabels || [];
                const nextLabels = [...currentLabels, ""];
                onChange({ maxStars: nextStars, starLabels: nextLabels });
              }}
            >
              <Plus className="size-3 mr-1 inline" /> Add Star
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground -mt-1">Labels displayed underneath rating options</p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {Array.from({ length: q.maxStars || 5 }).map((_, i) => {
              const currentLabels = q.starLabels || [];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">{i + 1} Star:</span>
                  <Input
                    value={currentLabels[i] || ""}
                    onChange={(e) => {
                      const next = [...currentLabels];
                      next[i] = e.target.value;
                      onChange({ starLabels: next });
                    }}
                    className="bg-white/5 border-white/10 h-7 text-xs flex-1"
                    placeholder={`Label for star ${i + 1}`}
                  />
                  {(q.maxStars || 5) > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-rose-300 hover:text-rose-400 cursor-pointer"
                      onClick={() => {
                        const currentStars = q.maxStars || 5;
                        const nextLabels = [...currentLabels];
                        nextLabels.splice(i, 1);
                        onChange({ maxStars: Math.max(1, currentStars - 1), starLabels: nextLabels });
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emoji list builder */}
      {q.type === "emoji" && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Emoji options</Label>
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
          <div className="space-y-2 mt-1 max-h-64 overflow-y-auto pr-1">
            {(q.emojis || [
              { emoji: "😡", label: "Very Unsatisfied" },
              { emoji: "😕", label: "Unsatisfied" },
              { emoji: "😐", label: "Neutral" },
              { emoji: "🙂", label: "Satisfied" },
              { emoji: "😍", label: "Extremely Satisfied" },
            ]).map((item, idx) => (
              <div key={idx} className="space-y-1 bg-white/5 p-1.5 rounded border border-white/5">
                <div className="flex items-center gap-1">
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
                  <div className="flex-1 flex gap-1 items-center">
                    <Input
                      value={item.label}
                      onChange={(e) => {
                        const next = [...(q.emojis || [])];
                        if (next[idx]) next[idx] = { ...next[idx], label: e.target.value };
                        onChange({ emojis: next });
                      }}
                      className="bg-white/5 border-white/10 h-7 text-xs flex-1"
                      placeholder="Label"
                    />
                    <EmojiPicker
                      onSelect={(emoji) => {
                        const next = [...(q.emojis || [])];
                        if (next[idx]) next[idx] = { ...next[idx], label: (item.label || "") + emoji };
                        onChange({ emojis: next });
                      }}
                    >
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7 shrink-0 bg-white/5 border-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Insert Emoji"
                      >
                        <Smile className="size-3.5" />
                      </Button>
                    </EmojiPicker>
                  </div>
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
                {/* Emoji quick-selector */}
                <div className="flex gap-1 flex-wrap pt-0.5 justify-start items-center">
                  {["😡", "😕", "😐", "🙂", "😍", "👍", "👎", "👏", "❤️", "🌟", "😀", "💡", "🔥"].map((char) => (
                    <button
                      key={char}
                      onClick={() => {
                        const next = [...(q.emojis || [])];
                        if (next[idx]) next[idx] = { ...next[idx], emoji: char };
                        onChange({ emojis: next });
                      }}
                      className={cn(
                        "text-xs p-0.5 rounded hover:bg-white/10 select-none cursor-pointer",
                        item.emoji === char && "bg-primary/20 border border-primary/30"
                      )}
                    >
                      {char}
                    </button>
                  ))}
                  <EmojiPicker
                    onSelect={(emoji) => {
                      const next = [...(q.emojis || [])];
                      if (next[idx]) next[idx] = { ...next[idx], emoji };
                      onChange({ emojis: next });
                    }}
                  >
                    <button
                      className="text-[10px] text-emerald-400 font-bold hover:bg-white/10 px-1 py-0.5 rounded border border-emerald-500/20 cursor-pointer shrink-0"
                      title="More emojis..."
                    >
                      + More
                    </button>
                  </EmojiPicker>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Info Form field checkboxes */}
      {q.type === "customer_info" && (
        <div className="space-y-3 border-t border-white/5 pt-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Fields to Display</Label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-name" className="text-xs cursor-pointer">Collect Full Name</Label>
              <Switch
                id="ci-name"
                checked={q.collectName !== false}
                onCheckedChange={(checked) => onChange({ collectName: checked })}
                className="scale-75 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-email" className="text-xs cursor-pointer">Collect Email Address</Label>
              <Switch
                id="ci-email"
                checked={q.collectEmail !== false}
                onCheckedChange={(checked) => onChange({ collectEmail: checked })}
                className="scale-75 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <Label htmlFor="ci-phone" className="text-xs cursor-pointer">Collect Phone Number</Label>
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
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const next = [...(q.options ?? [])];
                    next[i] = e.target.value;
                    onChange({ options: next });
                  }}
                  className="bg-white/5 border-white/10 flex-1"
                />
                <EmojiPicker
                  onSelect={(emoji) => {
                    const next = [...(q.options ?? [])];
                    next[i] = opt + emoji;
                    onChange({ options: next });
                  }}
                >
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 shrink-0 bg-white/5 border-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Insert Emoji"
                  >
                    <Smile className="size-4" />
                  </Button>
                </EmojiPicker>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-rose-300 hover:text-rose-400 cursor-pointer"
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

function BrandingInspector({
  branding,
  onChange,
}: {
  branding: {
    enabled: boolean;
    companyName: string;
    logoUrl: string;
    position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    size: number;
    offsetX: number;
    offsetY: number;
    brandColor?: string;
    fontFamily?: string;
    backgroundStyle?: "solid" | "gradient" | "default";
    themeMode?: "light" | "dark";
  };
  onChange: React.Dispatch<React.SetStateAction<{
    enabled: boolean;
    companyName: string;
    logoUrl: string;
    position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    size: number;
    offsetX: number;
    offsetY: number;
    brandColor?: string;
    fontFamily?: string;
    backgroundStyle?: "solid" | "gradient" | "default";
    themeMode?: "light" | "dark";
  }>>;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onChange((prev) => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground border-b border-white/5 pb-2 mb-1">
        Template Settings & Branding
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Brand Color
          </Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={branding.brandColor || "#0F766E"}
              onChange={(e) => onChange((prev) => ({ ...prev, brandColor: e.target.value }))}
              className="size-8 rounded border border-white/10 cursor-pointer bg-transparent"
            />
            <Input
              value={branding.brandColor || "#0F766E"}
              onChange={(e) => onChange((prev) => ({ ...prev, brandColor: e.target.value }))}
              placeholder="#0F766E"
              className="bg-white/5 border-white/10 text-xs h-8 font-mono flex-1"
            />
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {["#0F766E", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444"].map((c) => (
              <button
                key={c}
                onClick={() => onChange((prev) => ({ ...prev, brandColor: c }))}
                style={{ backgroundColor: c }}
                className={`size-5 rounded-full border border-white/20 cursor-pointer transition-transform ${
                  branding.brandColor === c ? "ring-2 ring-white scale-110" : "hover:scale-105"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Font Family
          </Label>
          <select
            className="w-full h-8 px-2 rounded bg-white/5 border border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-ring text-white"
            value={branding.fontFamily || "Inter"}
            onChange={(e) => onChange((prev) => ({ ...prev, fontFamily: e.target.value }))}
          >
            {[
              "Inter",
              "Roboto",
              "Poppins",
              "Outfit",
              "Montserrat",
              "Playfair Display",
              "Lora",
              "Nunito",
              "Raleway",
              "Quicksand",
              "Cinzel",
              "Caveat",
              "Fira Code"
            ].map((font) => (
              <option key={font} value={font} className="bg-[#18181b] text-white" style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Font Size
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {branding.fontSize === "normal"
                ? "36px (Normal)"
                : branding.fontSize === "large"
                ? "44px (Large)"
                : branding.fontSize === "xlarge"
                ? "52px (X-Large)"
                : `${branding.fontSize || 36}px (Custom)`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
            {(["normal", "large", "xlarge"] as const).map((size) => (
              <Button
                key={size}
                variant={(branding.fontSize || "normal") === size ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onChange((prev) => ({ ...prev, fontSize: size }))}
                className="h-7 text-[9px] px-0 uppercase tracking-wide font-semibold cursor-pointer"
              >
                {size === "normal" ? "Normal" : size === "large" ? "Large" : "X-Large"}
              </Button>
            ))}
            <Button
              variant={
                branding.fontSize &&
                !["normal", "large", "xlarge"].includes(branding.fontSize)
                  ? "secondary"
                  : "ghost"
              }
              size="sm"
              onClick={() => onChange((prev) => ({ ...prev, fontSize: "40" }))}
              className="h-7 text-[9px] px-0 uppercase tracking-wide font-semibold cursor-pointer"
            >
              Custom
            </Button>
          </div>
          {branding.fontSize && !["normal", "large", "xlarge"].includes(branding.fontSize) && (
            <div className="flex items-center gap-2 mt-1.5 bg-white/5 p-2 rounded-lg border border-white/5">
              <input
                type="range"
                min={16}
                max={72}
                value={parseInt(branding.fontSize || "40", 10) || 40}
                onChange={(e) => onChange((prev) => ({ ...prev, fontSize: e.target.value }))}
                className="flex-1 accent-teal-500 h-1.5 rounded bg-white/10 cursor-pointer"
              />
              <Input
                type="number"
                min={16}
                max={72}
                value={branding.fontSize || 40}
                onChange={(e) => {
                  const val = Math.min(72, Math.max(16, parseInt(e.target.value, 10) || 16));
                  onChange((prev) => ({ ...prev, fontSize: val.toString() }));
                }}
                className="w-16 bg-white/5 border-white/10 text-xs h-7 font-mono text-center text-white"
              />
              <span className="text-[10px] text-muted-foreground font-mono">px</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Text Color
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.textColor || "#FFFFFF"}
              onChange={(e) => onChange((prev) => ({ ...prev, textColor: e.target.value }))}
              className="size-7 rounded cursor-pointer bg-transparent border border-white/20"
            />
            <Input
              type="text"
              value={branding.textColor || ""}
              onChange={(e) => onChange((prev) => ({ ...prev, textColor: e.target.value }))}
              placeholder="Default (Auto)"
              className="bg-white/5 border-white/10 text-xs h-8 font-mono flex-1"
            />
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {["#FFFFFF", "#F8FAFC", "#94A3B8", "#0F172A", "#3B82F6", "#F59E0B"].map((c) => (
              <button
                key={c}
                onClick={() => onChange((prev) => ({ ...prev, textColor: c }))}
                style={{ backgroundColor: c }}
                className={`size-5 rounded-full border border-white/20 cursor-pointer transition-transform ${
                  branding.textColor === c ? "ring-2 ring-white scale-110" : "hover:scale-105"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Background Style
          </Label>
          <div className="grid grid-cols-3 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
            {(["default", "solid", "gradient"] as const).map((style) => (
              <Button
                key={style}
                variant={branding.backgroundStyle === style ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onChange((prev) => ({ ...prev, backgroundStyle: style }))}
                className="h-7 text-[9px] px-0 uppercase tracking-wide font-semibold cursor-pointer"
              >
                {style}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Theme Mode
          </Label>
          <div className="grid grid-cols-2 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
            {(["light", "dark"] as const).map((mode) => (
              <Button
                key={mode}
                variant={branding.themeMode === mode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onChange((prev) => ({ ...prev, themeMode: mode }))}
                className="h-7 text-[9px] px-0 uppercase tracking-wide font-semibold cursor-pointer"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}

function SurveyTabletPreview({
  open,
  onClose,
  name,
  questions,
  displayMode,
  branding,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  questions: BuilderQuestion[];
  displayMode: "multi_page" | "single_page";
  branding: {
    brandColor?: string;
    fontFamily?: string;
    backgroundStyle?: "solid" | "gradient" | "default";
    themeMode?: "light" | "dark";
    fontSize?: string;
    textColor?: string;
  };
}) {
  const [activePage, setActivePage] = React.useState(1);
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [completed, setCompleted] = React.useState(false);

  // Group questions by page
  const maxPage = React.useMemo(() => {
    if (displayMode === "single_page") return 1;
    return Math.max(1, ...questions.map((q) => q.page || 1));
  }, [questions, displayMode]);

  const pageQuestions = React.useMemo(() => {
    if (displayMode === "single_page") return questions;
    return questions.filter((q) => (q.page || 1) === activePage);
  }, [questions, displayMode, activePage]);

  // Compute theme colors
  const baseColor = branding.brandColor || "#0F766E";
  const bgStyle = React.useMemo(() => {
    if (branding.backgroundStyle === "solid") {
      return { background: baseColor };
    } else if (branding.backgroundStyle === "gradient") {
      return {
        background: `linear-gradient(135deg, ${baseColor} 0%, rgba(24, 24, 27, 0.95) 100%)`,
      };
    } else {
      return branding.themeMode === "light"
        ? { background: "#F8FAFC" }
        : { background: "#0b0f19" };
    }
  }, [branding.backgroundStyle, baseColor, branding.themeMode]);

  const isLight = branding.themeMode === "light";
  const textColor = isLight ? "text-zinc-900" : "text-white";
  const mutedTextColor = isLight ? "text-zinc-600" : "text-zinc-400";
  const cardBg = isLight ? "bg-white/80 border-black/10 text-zinc-900" : "bg-white/5 border-white/5 text-white";
  const previewFontSizePx = React.useMemo(() => {
    if (!branding.fontSize || branding.fontSize === "normal") return 14;
    if (branding.fontSize === "large") return 18;
    if (branding.fontSize === "xlarge") return 22;
    const num = parseInt(branding.fontSize, 10);
    return isNaN(num) ? 14 : Math.min(36, Math.max(12, Math.round(num * 0.45)));
  }, [branding.fontSize]);

  const handleNext = () => {
    if (activePage < maxPage) {
      setActivePage(activePage + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleBack = () => {
    if (activePage > 1) {
      setActivePage(activePage - 1);
    }
  };

  const handleReset = () => {
    setActivePage(1);
    setAnswers({});
    setCompleted(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-6 bg-[#0c0c0e]/95 backdrop-blur-xl border-white/10 text-white overflow-hidden flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Eye className="size-4 text-primary" /> Tablet Survey Preview
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            This simulates how your survey renders in real-time on a tablet device.
          </DialogDescription>
        </DialogHeader>

        {/* Mock Tablet Wrapper */}
        <div className="flex-1 flex items-center justify-center p-2 bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
          {/* Tablet Case */}
          <div className="w-full max-w-3xl aspect-[16/10] bg-zinc-800 rounded-[28px] p-3 shadow-2xl border-4 border-zinc-700 flex flex-col relative">
            {/* Camera dot */}
            <div className="absolute left-1/2 -translate-x-1/2 top-1.5 size-1.5 rounded-full bg-zinc-900" />
            
            {/* Screen */}
            <div 
              style={{ ...bgStyle, fontFamily: branding.fontFamily || "Inter" }}
              className={cn(
                "flex-1 rounded-[18px] p-6 overflow-y-auto flex flex-col justify-between transition-all duration-300 relative select-none",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {completed ? (
                /* Thank You / Success Screen */
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 grid place-items-center animate-bounce">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h2 className="text-2xl font-bold">Thank You!</h2>
                  <p className={cn("text-xs max-w-xs", mutedTextColor)}>
                    Your response has been recorded successfully.
                  </p>
                  <Button 
                    onClick={handleReset} 
                    className="mt-2 bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    size="sm"
                  >
                    Submit Another Response
                  </Button>
                </div>
              ) : (
                /* Survey Interface */
                <div className="flex-1 flex flex-col justify-between h-full">
                  {/* Top Bar */}
                  <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4 shrink-0">
                    <div className="text-sm font-bold truncate max-w-xs">{name}</div>
                    {displayMode === "multi_page" && (
                      <div className={cn("text-xs font-semibold", mutedTextColor)}>
                        Page {activePage} of {maxPage}
                      </div>
                    )}
                  </div>

                  {/* Questions Grid */}
                  <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
                    {pageQuestions.map((q) => {
                      const ans = answers[q.id];
                      return (
                        <div 
                          key={q.id} 
                          className={cn("p-4 rounded-xl border backdrop-blur-md transition-all duration-200", cardBg)}
                        >
                          <div className="mb-2.5 flex items-baseline gap-1.5" style={{ fontSize: `${previewFontSizePx}px`, color: branding.textColor || undefined }}>
                            <span className="font-semibold">{q.label}</span>
                            {q.required && <span className="text-rose-400 text-[10px]">*</span>}
                          </div>

                          {/* Render Question Answer Control */}
                          {q.type === "rating" && (
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => setAnswers({ ...answers, [q.id]: star })}
                                  className="transition-transform active:scale-95 cursor-pointer"
                                >
                                  <Star 
                                    className={cn(
                                      "size-7", 
                                      ans >= star ? "text-amber-400 fill-amber-400" : "text-zinc-400"
                                    )} 
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {q.type === "nps" && (
                            <div className="flex gap-1 flex-wrap">
                              {Array.from({ length: 11 }).map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => setAnswers({ ...answers, [q.id]: i })}
                                  className={cn(
                                    "size-8 rounded-lg border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors",
                                    ans === i 
                                      ? "bg-white text-zinc-950 border-white" 
                                      : "bg-black/20 border-white/10 hover:bg-black/30 text-white"
                                  )}
                                >
                                  {i}
                                </button>
                              ))}
                            </div>
                          )}

                          {q.type === "emoji" && (
                            <div className="flex gap-3">
                              {["😡", "😐", "🙂", "😍"].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => setAnswers({ ...answers, [q.id]: emoji })}
                                  className={cn(
                                    "text-2xl p-1 rounded-full transition-transform active:scale-95 cursor-pointer",
                                    ans === emoji ? "bg-white/20 ring-2 ring-white" : "opacity-70 hover:opacity-100"
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {q.type === "yes_no" && (
                            <div className="flex gap-2">
                              {["Yes", "No"].map((opt) => (
                                <Button
                                  key={opt}
                                  variant={ans === opt ? "default" : "outline"}
                                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                  size="sm"
                                  className="h-8 w-20 text-xs cursor-pointer"
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          )}

                          {q.type === "single_choice" && (
                            <div className="space-y-1.5 max-w-md">
                              {(q.options || ["Option 1", "Option 2"]).map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                  className={cn(
                                    "w-full text-left px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all",
                                    ans === opt 
                                      ? "bg-white text-zinc-950 border-white" 
                                      : "bg-black/20 border-white/10 hover:bg-black/30 text-white"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {q.type === "multiple_choice" && (
                            <div className="space-y-1.5 max-w-md">
                              {(q.options || ["Option 1", "Option 2"]).map((opt) => {
                                const currentList = Array.isArray(ans) ? ans : [];
                                const isChecked = currentList.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const nextList = isChecked
                                        ? currentList.filter(x => x !== opt)
                                        : [...currentList, opt];
                                      setAnswers({ ...answers, [q.id]: nextList });
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all",
                                      isChecked 
                                        ? "bg-white/10 border-white text-white" 
                                        : "bg-black/20 border-white/10 hover:bg-black/30 text-white"
                                    )}
                                  >
                                    <div className={cn(
                                      "size-3.5 rounded border flex items-center justify-center shrink-0",
                                      isChecked ? "bg-white border-white text-zinc-950" : "border-white/40"
                                    )}>
                                      {isChecked && <CheckCircle2 className="size-2.5 fill-current" />}
                                    </div>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {q.type === "short_text" && (
                            <Input
                              placeholder="Type comment..."
                              value={ans || ""}
                              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                              className="bg-black/20 border-white/10 text-xs h-8 max-w-md focus-visible:ring-1 text-white"
                            />
                          )}

                          {q.type === "long_text" && (
                            <Textarea
                              placeholder="Type detailed response..."
                              value={ans || ""}
                              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                              className="bg-black/20 border-white/10 text-xs max-w-md focus-visible:ring-1 text-white"
                            />
                          )}

                          {q.type === "customer_info" && (
                            <div className="space-y-2 max-w-md">
                              <Input
                                placeholder="Full Name"
                                value={ans?.name || ""}
                                onChange={(e) => setAnswers({
                                  ...answers,
                                  [q.id]: { ...(ans || {}), name: e.target.value }
                                })}
                                className="bg-black/20 border-white/10 text-xs h-8 focus-visible:ring-1 text-white"
                              />
                              <Input
                                placeholder="Email Address"
                                value={ans?.email || ""}
                                onChange={(e) => setAnswers({
                                  ...answers,
                                  [q.id]: { ...(ans || {}), email: e.target.value }
                                })}
                                className="bg-black/20 border-white/10 text-xs h-8 focus-visible:ring-1 text-white"
                              />
                              <Input
                                placeholder="Phone Number"
                                value={ans?.phone || ""}
                                onChange={(e) => setAnswers({
                                  ...answers,
                                  [q.id]: { ...(ans || {}), phone: e.target.value }
                                })}
                                className="bg-black/20 border-white/10 text-xs h-8 focus-visible:ring-1 text-white"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation Footer */}
                  <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-4 shrink-0">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      disabled={activePage === 1}
                      className={cn("h-8 text-xs font-semibold select-none cursor-pointer", isLight ? "hover:bg-black/5 text-zinc-900" : "hover:bg-white/5 text-white")}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleNext}
                      style={{ backgroundColor: baseColor }}
                      className="h-8 text-xs font-semibold px-6 select-none cursor-pointer text-white shadow"
                    >
                      {activePage === maxPage ? "Submit" : "Next"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Home indicator bar */}
            <div className="w-24 h-1 bg-zinc-900/60 rounded-full mx-auto mt-2 shrink-0" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
