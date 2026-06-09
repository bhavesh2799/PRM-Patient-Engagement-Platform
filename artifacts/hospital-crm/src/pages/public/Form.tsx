import { useSubmitPublicForm } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function PublicForm() {
  const submitForm = useSubmitPublicForm();
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    specialization: "General",
    message: "",
    preferredDate: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm.mutate(
      { data: formData },
      { onSuccess: () => setSuccess(true) }
    );
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-8">
          <CardContent className="flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <CardTitle className="text-2xl mb-2">Request Received</CardTitle>
            <p className="text-muted-foreground">
              Thank you for reaching out. A representative from our hospital will contact you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Book an Appointment</CardTitle>
          <CardDescription>Fill out the form below to request a callback.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mobile Number</label>
              <Input required type="tel" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Specialization</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={formData.specialization}
                onChange={e => setFormData({...formData, specialization: e.target.value})}
              >
                <option value="General">General Physician</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Neurology">Neurology</option>
              </select>
            </div>
            <Button className="w-full mt-6" type="submit" disabled={submitForm.isPending}>
              {submitForm.isPending ? "Submitting..." : "Request Appointment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
