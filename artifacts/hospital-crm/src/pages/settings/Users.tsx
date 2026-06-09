import { AppLayout } from "@/components/layout/AppLayout";
import { useListUsers, useCreateUser, useUpdateUser, getListUsersQueryKey, useGetSessionRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const { data: session } = useGetSessionRole();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "exec" as any
  });

  const isAdmin = session?.role === "ap_admin" || session?.role === "manager";

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("User invited successfully");
          setIsDialogOpen(false);
          setFormData({ name: "", email: "", role: "exec" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateUser.mutate(
      { id, data: { active: !currentActive } },
      {
        onSuccess: () => {
          toast.success(`User ${currentActive ? 'deactivated' : 'activated'}`);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'ap_admin': return <Badge className="bg-purple-500">AP Admin</Badge>;
      case 'manager': return <Badge className="bg-blue-500">Manager</Badge>;
      case 'exec': return <Badge variant="secondary">Executive</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Team & Users</h1>
            <p className="text-muted-foreground mt-1">Manage platform access and roles.</p>
          </div>
          
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Invite User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <select className="w-full h-10 px-3 rounded-md border" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                      <option value="exec">Front-office Exec</option>
                      <option value="manager">Marketing Manager</option>
                      {session?.role === 'ap_admin' && <option value="ap_admin">Affordplan Admin</option>}
                    </select>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createUser.isPending}>
                      {createUser.isPending ? "Inviting..." : "Send Invite"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : !users?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">No users found</TableCell></TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "default" : "secondary"}>
                          {user.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleActive(user.id, user.active)} className={user.active ? "text-destructive" : "text-green-600"}>
                                {user.active ? "Deactivate User" : "Activate User"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
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