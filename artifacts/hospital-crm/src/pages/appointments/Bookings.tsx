import { AppLayout } from "@/components/layout/AppLayout";
import { useListAppointments, useUpdateAppointment, getListAppointmentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Bookings() {
  const { data: appointments, isLoading } = useListAppointments();
  const updateAppointment = useUpdateAppointment();
  const queryClient = useQueryClient();

  const handleStatusChange = (id: number, status: 'booked' | 'confirmed' | 'completed' | 'cancelled') => {
    updateAppointment.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bookings</h1>
            <p className="text-muted-foreground mt-1">Manage patient appointments.</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : appointments?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4">No appointments found</TableCell></TableRow>
                ) : (
                  appointments?.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">
                        {format(new Date(apt.datetime), 'PP p')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{apt.leadName}</div>
                        <div className="text-xs text-muted-foreground">{apt.leadMobile}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{apt.doctorName}</div>
                        <div className="text-xs text-muted-foreground">{apt.specialization}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {apt.sourceChannel.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            apt.status === 'completed' ? 'default' : 
                            apt.status === 'cancelled' ? 'destructive' : 
                            'secondary'
                          } 
                          className="capitalize"
                        >
                          {apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(apt.id, 'confirmed')}>Mark Confirmed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(apt.id, 'completed')}>Mark Completed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(apt.id, 'cancelled')} className="text-destructive">Cancel Appointment</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
