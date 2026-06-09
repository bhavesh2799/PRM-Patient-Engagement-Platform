import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, Check, X, Tag } from "lucide-react";
import { toast } from "sonner";

interface TagItem {
  id: number;
  name: string;
  color: string;
  archived: boolean;
  createdAt: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#64748b", "#78716c",
];

function ColorDot({ color, selected, onClick }: { color: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
      style={{ backgroundColor: color, borderColor: selected ? "black" : "transparent" }}
    />
  );
}

export default function Tags() {
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery<TagItem[]>({
    queryKey: ["tags"],
    queryFn: () => fetch("/api/tags").then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); toast.success("Tag created"); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TagItem> }) =>
      fetch(`/api/tags/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); toast.success("Tag deleted"); },
  });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const visibleTags = showArchived ? tags : tags.filter(t => !t.archived);

  const handleCreate = () => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    createMut.mutate({ name: newName.trim(), color: newColor });
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
  };

  const startEdit = (tag: TagItem) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (!editId || !editName.trim()) return;
    updateMut.mutate({ id: editId, data: { name: editName.trim(), color: editColor } });
    setEditId(null);
    toast.success("Tag updated");
  };

  const toggleArchive = (tag: TagItem) => {
    updateMut.mutate({ id: tag.id, data: { archived: !tag.archived } });
    toast.success(tag.archived ? "Tag restored" : "Tag archived");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage lead tags for classification and filtering.</p>
        </div>

        {/* Create new tag */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">New Tag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Tag name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-9"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
              <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Colour:</span>
              {PRESET_COLORS.map(c => (
                <ColorDot key={c} color={c} selected={newColor === c} onClick={() => setNewColor(c)} />
              ))}
            </div>
            {newName && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <Badge className="text-white text-xs" style={{ backgroundColor: newColor }}>
                  <Tag className="w-3 h-3 mr-1" /> {newName}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tags list */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Tags ({visibleTags.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Loading tags…</div>
            ) : visibleTags.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No tags yet — create your first one above
              </div>
            ) : (
              <div className="space-y-2">
                {visibleTags.map(tag => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${tag.archived ? "opacity-50 bg-muted/30" : "bg-card"}`}
                  >
                    {editId === tag.id ? (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="h-7 text-sm flex-1"
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                          autoFocus
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {PRESET_COLORS.map(c => (
                            <ColorDot key={c} color={c} selected={editColor === c} onClick={() => setEditColor(c)} />
                          ))}
                        </div>
                        <button onClick={saveEdit} className="text-green-600 hover:text-green-700">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-sm font-medium flex-1">{tag.name}</span>
                        {tag.archived && <Badge variant="outline" className="text-xs">Archived</Badge>}
                        <div className="flex items-center gap-1">
                          {!tag.archived && (
                            <button
                              onClick={() => startEdit(tag)}
                              className="text-muted-foreground hover:text-foreground p-1 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleArchive(tag)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
