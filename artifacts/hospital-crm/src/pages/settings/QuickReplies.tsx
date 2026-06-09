import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface QuickReply {
  id: number;
  text: string;
  sortOrder: number;
  createdAt: string;
}

export default function QuickReplies() {
  const queryClient = useQueryClient();

  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["quick-replies"],
    queryFn: () => fetch("/api/settings/quick-replies").then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (text: string) =>
      fetch("/api/settings/quick-replies", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quick-replies"] }); toast.success("Quick reply added"); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) =>
      fetch(`/api/settings/quick-replies/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quick-replies"] }); toast.success("Quick reply updated"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/settings/quick-replies/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quick-replies"] }); toast.success("Quick reply deleted"); },
  });

  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleCreate = () => {
    if (!newText.trim()) { toast.error("Reply text is required"); return; }
    createMut.mutate(newText.trim());
    setNewText("");
  };

  const startEdit = (reply: QuickReply) => {
    setEditId(reply.id);
    setEditText(reply.text);
  };

  const saveEdit = () => {
    if (!editId || !editText.trim()) return;
    updateMut.mutate({ id: editId, text: editText.trim() });
    setEditId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quick Replies</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Saved message snippets available in the Inbox composer for fast, consistent responses.
          </p>
        </div>

        {/* Create new */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Add Quick Reply</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Type your quick reply message here…"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{newText.length} characters</p>
              <Button size="sm" onClick={handleCreate} disabled={createMut.isPending || !newText.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Reply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Saved Replies ({replies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Loading…</div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No quick replies yet — add your first one above
              </div>
            ) : (
              <div className="space-y-2">
                {replies.map((reply, i) => (
                  <div key={reply.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                      {editId === reply.id ? (
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="text-sm min-h-[70px] resize-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={saveEdit} disabled={!editText.trim()}>
                              <Check className="w-3.5 h-3.5 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                              <X className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm flex-1 leading-relaxed">{reply.text}</p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEdit(reply)}
                              className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMut.mutate(reply.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
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
