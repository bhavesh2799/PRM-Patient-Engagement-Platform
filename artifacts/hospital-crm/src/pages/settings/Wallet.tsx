import { AppLayout } from "@/components/layout/AppLayout";
import { useGetWallet, useGetSessionRole, useResetDemoData, useTopupWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Wallet as WalletIcon, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function WalletPage() {
  const { data: wallet, isLoading } = useGetWallet();
  const { data: session } = useGetSessionRole();
  const resetDemoData = useResetDemoData();
  const topupWallet = useTopupWallet();
  const queryClient = useQueryClient();
  const [isTopupLoading, setIsTopupLoading] = useState(false);

  const canAddMoney = session?.role === "ap_admin" || session?.role === "manager";

  const handleTopup = () => {
    setIsTopupLoading(true);
    // Simulate payment gateway delay
    setTimeout(() => {
      topupWallet.mutate(
        { data: { amount: 10000 } },
        { 
          onSuccess: () => {
            toast.success("₹10,000 added to wallet successfully");
            queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
            setIsTopupLoading(false);
          },
          onError: () => setIsTopupLoading(false)
        }
      );
    }, 1500);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all demo data? This cannot be undone.")) {
      resetDemoData.mutate(undefined, {
        onSuccess: () => {
          toast.success("Demo data reset successfully");
          window.location.reload();
        }
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading wallet...</div>
      </AppLayout>
    );
  }

  const isLowBalance = wallet && wallet.balance < 5000;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Wallet & Billing</h1>
            <p className="text-muted-foreground mt-1">Manage your prepaid balance for marketing campaigns.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={resetDemoData.isPending} className="text-destructive border-destructive hover:bg-destructive/10">
              <RefreshCw className="w-4 h-4 mr-2" /> Reset Demo Data
            </Button>
            {canAddMoney && (
              <Button onClick={handleTopup} disabled={isTopupLoading}>
                <Plus className="w-4 h-4 mr-2" /> {isTopupLoading ? "Processing..." : "Add ₹10,000"}
              </Button>
            )}
          </div>
        </div>

        {isLowBalance && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 text-orange-500" />
            <div>
              <h4 className="font-semibold text-orange-900">Low Balance Alert</h4>
              <p className="text-sm">Your wallet balance is below ₹5,000. Active campaigns may be paused if they run out of funds. Please recharge soon.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground border-primary md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-primary-foreground/80 flex items-center gap-2 text-lg">
                <WalletIcon className="w-5 h-5" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">
                ₹{wallet?.balance.toLocaleString('en-IN') || 0}
              </div>
              <p className="text-primary-foreground/70 text-sm">
                Available for outbound engagements
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!wallet?.transactions?.length ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4">No transactions found</TableCell></TableRow>
                  ) : (
                    wallet.transactions.slice(0, 5).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(tx.createdAt), 'PP')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tx.description}</div>
                          {tx.reference && <div className="text-xs text-muted-foreground">{tx.reference}</div>}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.type === 'topup' ? 'text-green-600' : ''}`}>
                          {tx.type === 'topup' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
