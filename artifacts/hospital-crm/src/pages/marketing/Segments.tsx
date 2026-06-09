import { AppLayout } from "@/components/layout/AppLayout";
import { useListSegments, useCreateSegment, useDeleteSegment, getListSegmentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Segments() {
  const { data: segments, isLoading } = useListSegments();
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    source: "affordplan" as any
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSegment.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("Segment created");
          setIsDialogOpen(false);
          setFormData({ name: "", description: "", source: "affordplan" });
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this segment?")) {
      deleteSegment.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Segment deleted");
            queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
          }
        }
      );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Audience Segments</h1>
            <p className="text-muted-foreground mt-1">Manage target audiences for your campaigns.</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create Segment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Segment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Segment Name</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Diabetics Q1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Data</label>
                  <select className="w-full h-10 px-3 rounded-md border" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value as any})}>
                    <option value="affordplan">Affordplan CRM</option>
                    <option value="his">HIS System</option>
                    <option value="csv">CSV Upload</option>
                  </select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={createSegment.isPending}>
                    {createSegment.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Segments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Audience Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : !segments?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">No segments found</TableCell></TableRow>
                ) : (
                  segments.map((segment) => (
                    <TableRow key={segment.id}>
                      <TableCell>
                        <div className="font-medium">{segment.name}</div>
                        <div className="text-xs text-muted-foreground">{segment.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {segment.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {segment.count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(segment.createdAt), 'PP')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(segment.id)}>
                          <Trash className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}