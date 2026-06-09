import { AppLayout } from "@/components/layout/AppLayout";
import { useListContactVariables, useCreateContactVariable, useDeleteContactVariable, getListContactVariablesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Variables() {
  const { data: variables, isLoading } = useListContactVariables();
  const createVariable = useCreateContactVariable();
  const deleteVariable = useDeleteContactVariable();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    mandatory: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createVariable.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("Variable added");
          setIsDialogOpen(false);
          setFormData({ name: "", description: "", mandatory: false });
          queryClient.invalidateQueries({ queryKey: getListContactVariablesQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this variable?")) {
      deleteVariable.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Variable deleted");
            queryClient.invalidateQueries({ queryKey: getListContactVariablesQueryKey() });
          }
        }
      );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Contact Variables</h1>
            <p className="text-muted-foreground mt-1">Manage dynamic variables used in message templates.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Variable</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Variable</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Variable Name</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. {{appointment_date}}" />
                  <p className="text-xs text-muted-foreground">Must be alphanumeric with underscores.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="mandatory" checked={formData.mandatory} onChange={e => setFormData({...formData, mandatory: e.target.checked})} />
                  <label htmlFor="mandatory" className="text-sm font-medium">Mandatory for all leads</label>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={createVariable.isPending}>
                    {createVariable.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Variables</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : !variables?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">No variables found</TableCell></TableRow>
                ) : (
                  variables.map((variable) => (
                    <TableRow key={variable.id}>
                      <TableCell className="font-mono text-sm bg-muted/30">
                        {variable.name}
                      </TableCell>
                      <TableCell>{variable.description}</TableCell>
                      <TableCell>
                        {variable.system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {variable.mandatory ? (
                          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Required</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Optional</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!variable.system && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(variable.id)}>
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
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