import { AppLayout } from "@/components/layout/AppLayout";
import { useGetHospital, useUpdateHospital } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function Profile() {
  const { data: hospital, isLoading } = useGetHospital();
  const updateHospital = useUpdateHospital();

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    address: ""
  });

  useEffect(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || "",
        contact: hospital.contact || "",
        address: hospital.address || ""
      });
    }
  }, [hospital]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateHospital.mutate(
      { data: formData },
      { onSuccess: () => toast.success("Hospital profile updated successfully") }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading profile...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hospital Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your hospital's basic information.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5"/> Organization Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hospital Name</label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Contact</label>
                <Input 
                  value={formData.contact} 
                  onChange={e => setFormData({...formData, contact: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Textarea 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                  rows={3}
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={updateHospital.isPending}>
                  {updateHospital.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
