import { AppLayout } from "@/components/layout/AppLayout";
import { useListLeads, useGetLead, useUpdateLead, getListLeadsQueryKey, useGetSessionRole } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Phone, MessageSquare, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Inbox() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  
  const { data: leads, isLoading: leadsLoading } = useListLeads();
  const { data: selectedLead, isLoading: leadLoading } = useGetLead(selectedLeadId as number, { 
    query: { enabled: !!selectedLeadId, queryKey: ['getLead', selectedLeadId] } 
  });
  const { data: session } = useGetSessionRole();
  
  const updateLead = useUpdateLead();
  const queryClient = useQueryClient();

  const handlePickUp = (id: number) => {
    if (!session?.userId) return;
    updateLead.mutate(
      { id, data: { ownerUserId: session.userId, status: 'in_progress' } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ['getLead', id] });
        }
      }
    );
  };

  const handleStatusChange = (id: number, status: 'new' | 'contacted' | 'in_progress' | 'fulfilled' | 'closed') => {
    updateLead.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ['getLead', id] });
        }
      }
    );
  };

  const filteredLeads = leads?.filter(lead => 
    lead.firstName.toLowerCase().includes(search.toLowerCase()) || 
    lead.lastName.toLowerCase().includes(search.toLowerCase()) ||
    lead.mobile.includes(search)
  ) || [];

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Unified Inbox</h1>
            <p className="text-muted-foreground mt-1">Manage and respond to all incoming patient leads.</p>
          </div>
        </div>

        <div className="flex gap-4 h-full overflow-hidden">
          {/* Left Pane: Lead List */}
          <Card className="w-1/3 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {leadsLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading leads...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No leads found</div>
              ) : (
                <div className="divide-y">
                  {filteredLeads.map((lead) => (
                    <div 
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedLeadId === lead.id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{lead.firstName} {lead.lastName}</div>
                        <Badge variant={lead.status === 'new' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.mobile}
                        </div>
                        <div className="uppercase bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                          {lead.sourceChannel.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex justify-between items-center">
                        <span>{lead.specialization || 'General'}</span>
                        <span>{format(new Date(lead.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Right Pane: Lead Profile & Chat */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {!selectedLeadId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a lead to view details and start chatting</p>
              </div>
            ) : leadLoading || !selectedLead ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading profile...
              </div>
            ) : (
              <>
                <div className="p-6 border-b flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      {selectedLead.firstName} {selectedLead.lastName}
                      {selectedLead.uhid && <Badge variant="outline">UHID: {selectedLead.uhid}</Badge>}
                    </h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {selectedLead.mobile}</span>
                      <span>Channel: <strong className="uppercase">{selectedLead.sourceChannel.replace('_', ' ')}</strong></span>
                      <span>Specialization: <strong>{selectedLead.specialization || 'N/A'}</strong></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      {!selectedLead.ownerUserId ? (
                        <Button onClick={() => handlePickUp(selectedLead.id)} size="sm">
                          <UserPlus className="h-4 w-4 mr-2" /> Pick Up Lead
                        </Button>
                      ) : (
                        <div className="text-sm border px-3 py-1.5 rounded bg-secondary text-secondary-foreground">
                          Owned by: {selectedLead.ownerName || 'You'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <select 
                        className="text-sm border rounded p-1 bg-background"
                        value={selectedLead.status}
                        onChange={(e) => handleStatusChange(selectedLead.id, e.target.value as any)}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="in_progress">In Progress</option>
                        <option value="fulfilled">Fulfilled</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 p-6 border-r flex flex-col">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Conversation</h3>
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
                      <div className="text-center">
                        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                        <p className="text-sm text-muted-foreground">Chat interface for {selectedLead.sourceChannel}</p>
                        <Button variant="outline" className="mt-4" size="sm">
                          Send Template Message <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-80 p-6 flex flex-col bg-muted/10">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Activity Log</h3>
                    <ScrollArea className="flex-1 -mx-2 px-2">
                      <div className="space-y-4">
                        {selectedLead.activityLog?.map((log) => (
                          <div key={log.id} className="text-sm relative pl-4 border-l-2 border-primary/20 pb-4 last:pb-0">
                            <div className="absolute w-2 h-2 bg-primary rounded-full -left-[5px] top-1"></div>
                            <div className="font-medium">{log.type}</div>
                            <div className="text-muted-foreground mt-0.5">{log.description}</div>
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {format(new Date(log.createdAt), 'MMM d, h:mm a')} {log.userName ? `by ${log.userName}` : ''}
                            </div>
                          </div>
                        )) || (
                          <div className="text-sm text-muted-foreground">No recent activity.</div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
