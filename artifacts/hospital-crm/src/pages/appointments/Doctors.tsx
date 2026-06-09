import { AppLayout } from "@/components/layout/AppLayout";
import { useListDoctors } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Doctors() {
  const { data: doctors, isLoading } = useListDoctors();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Doctors</h1>
            <p className="text-muted-foreground mt-1">Manage doctor profiles and schedules.</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Add Doctor
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div>Loading...</div>
          ) : doctors?.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No doctors found</div>
          ) : (
            doctors?.map((doctor) => (
              <Card key={doctor.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <div>
                      <div className="text-lg">{doctor.name}</div>
                      <div className="text-sm font-normal text-muted-foreground">{doctor.specialization}</div>
                    </div>
                    <Badge variant={doctor.active ? "default" : "secondary"}>
                      {doctor.active ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {doctor.experience && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="font-medium">{doctor.experience} Years</span>
                      </div>
                    )}
                    {doctor.qualifications && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Qualifications</span>
                        <span className="font-medium text-right max-w-[150px] truncate" title={doctor.qualifications}>
                          {doctor.qualifications}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="secondary" size="sm">Schedule</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
