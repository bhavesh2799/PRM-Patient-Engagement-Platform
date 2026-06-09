import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomeDashboard from "@/pages/home/Dashboard";
import AppointmentsDashboard from "@/pages/appointments/Dashboard";
import Bookings from "@/pages/appointments/Bookings";
import Doctors from "@/pages/appointments/Doctors";
import CrmDashboard from "@/pages/crm/Dashboard";
import CrmInbox from "@/pages/crm/Inbox";
import CrmCsvUpload from "@/pages/crm/CsvUpload";
import MarketingDashboard from "@/pages/marketing/Dashboard";
import Campaigns from "@/pages/marketing/Campaigns";
import Templates from "@/pages/marketing/Templates";
import Segments from "@/pages/marketing/Segments";
import Metrics from "@/pages/marketing/Metrics";
import Integrations from "@/pages/settings/Integrations";
import SendRules from "@/pages/settings/SendRules";
import Profile from "@/pages/settings/Profile";
import Variables from "@/pages/settings/Variables";
import Users from "@/pages/settings/Users";
import Wallet from "@/pages/settings/Wallet";
import SuperAdminChannels from "@/pages/super-admin/Channels";
import SuperAdminTemplates from "@/pages/super-admin/Templates";
import SuperAdminCampaigns from "@/pages/super-admin/Campaigns";
import PublicForm from "@/pages/public/Form";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeDashboard} />
      <Route path="/appointments/dashboard" component={AppointmentsDashboard} />
      <Route path="/appointments/bookings" component={Bookings} />
      <Route path="/appointments/doctors" component={Doctors} />
      
      <Route path="/crm/dashboard" component={CrmDashboard} />
      <Route path="/crm/inbox" component={CrmInbox} />
      <Route path="/crm/csv-upload" component={CrmCsvUpload} />
      
      <Route path="/marketing/dashboard" component={MarketingDashboard} />
      <Route path="/marketing/campaigns" component={Campaigns} />
      <Route path="/marketing/templates" component={Templates} />
      <Route path="/marketing/segments" component={Segments} />
      <Route path="/marketing/metrics" component={Metrics} />
      
      <Route path="/settings/integrations" component={Integrations} />
      <Route path="/settings/send-rules" component={SendRules} />
      <Route path="/settings/profile" component={Profile} />
      <Route path="/settings/variables" component={Variables} />
      <Route path="/settings/users" component={Users} />
      <Route path="/settings/wallet" component={Wallet} />
      
      <Route path="/super-admin/channels" component={SuperAdminChannels} />
      <Route path="/super-admin/templates" component={SuperAdminTemplates} />
      <Route path="/super-admin/campaigns" component={SuperAdminCampaigns} />
      
      <Route path="/form" component={PublicForm} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
