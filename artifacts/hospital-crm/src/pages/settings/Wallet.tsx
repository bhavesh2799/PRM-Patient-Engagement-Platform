import { AppLayout } from "@/components/layout/AppLayout";
import { useGetWallet, useGetSessionRole, useResetDemoData, useTopupWallet, getGetWalletQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Wallet as WalletIcon, Plus, AlertCircle, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type ModalStep = "input" | "gateway" | "processing" | "success" | "failed";
const PAYMENT_METHODS = ["PayU", "Easebuzz"] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

function mockOrderId() {
  return `PG-TXN-${Date.now().toString().slice(-8)}`;
}

export default function WalletPage() {
  const { data: wallet, isLoading } = useGetWallet();
  const { data: session } = useGetSessionRole();
  const resetDemoData = useResetDemoData();
  const topupWallet = useTopupWallet();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("input");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("PayU");
  const [orderId, setOrderId] = useState("");
  const [simulateFail, setSimulateFail] = useState(false);
  const [newBalance, setNewBalance] = useState(0);

  const canAddMoney = session?.role === "ap_admin" || session?.role === "manager";

  const openModal = () => {
    setStep("input");
    setAmount("");
    setAmountError("");
    setMethod("PayU");
    setSimulateFail(false);
    setOrderId("");
    setModalOpen(true);
  };

  const handleContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val)) { setAmountError("Please enter a valid amount."); return; }
    if (val < 500) { setAmountError("Minimum top-up amount is ₹500."); return; }
    if (val > 500000) { setAmountError("Maximum top-up amount is ₹5,00,000."); return; }
    setAmountError("");
    setStep("gateway");
    // Simulate redirect delay
    setTimeout(() => {
      setOrderId(mockOrderId());
    }, 1000);
  };

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => {
      if (simulateFail) {
        setStep("failed");
      } else {
        const val = parseFloat(amount);
        topupWallet.mutate(
          { data: { amount: val } },
          {
            onSuccess: () => {
              setNewBalance((wallet?.balance ?? 0) + val);
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              setStep("success");
            },
            onError: () => setStep("failed"),
          }
        );
      }
    }, 2000);
  };

  const handleCancel = () => {
    setStep("input");
    setOrderId("");
  };

  const handleDone = () => {
    setModalOpen(false);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all demo data? This cannot be undone.")) {
      resetDemoData.mutate(undefined, {
        onSuccess: () => {
          toast.success("Demo data reset successfully");
          window.location.reload();
        },
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading wallet…</div>
      </AppLayout>
    );
  }

  const isLowBalance = wallet && wallet.balance < 5000;
  const parsedAmount = parseFloat(amount) || 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Wallet & Billing</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage your prepaid balance for outbound campaigns.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={resetDemoData.isPending} className="text-destructive border-destructive hover:bg-destructive/10">
              <RefreshCw className="w-4 h-4 mr-2" /> Reset Demo Data
            </Button>
            {canAddMoney && (
              <Button onClick={openModal}>
                <Plus className="w-4 h-4 mr-2" /> Add Money
              </Button>
            )}
          </div>
        </div>

        {isLowBalance && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 text-orange-500" />
            <div>
              <h4 className="font-semibold text-orange-900">Low Balance Alert</h4>
              <p className="text-sm">Your wallet balance is below ₹5,000. Active campaigns may be paused if funds run out. Please top up soon.</p>
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
                ₹{wallet?.balance.toLocaleString("en-IN") ?? 0}
              </div>
              <p className="text-primary-foreground/70 text-sm">Available for outbound engagements</p>
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
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No transactions yet</TableCell></TableRow>
                  ) : (
                    wallet.transactions.slice(0, 8).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(tx.createdAt), "PP")}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{tx.description}</div>
                          {tx.reference && <div className="text-xs text-muted-foreground font-mono">{tx.reference}</div>}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.type === "topup" ? "text-green-600" : "text-red-600"}`}>
                          {tx.type === "topup" ? "+" : "−"}₹{tx.amount.toLocaleString("en-IN")}
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

      {/* ── Add Money Modal ─────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open && step !== "processing") setModalOpen(false); }}>
        <DialogContent className="max-w-md" onInteractOutside={e => step === "processing" && e.preventDefault()}>

          {/* ── Step 1: Amount input ── */}
          {step === "input" && (
            <>
              <DialogHeader>
                <DialogTitle>Add Money to Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Amount (₹)</label>
                  <Input
                    type="number"
                    min={500}
                    max={500000}
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setAmountError(""); }}
                    className={amountError ? "border-red-400" : ""}
                    autoFocus
                  />
                  {amountError && <p className="text-sm text-red-500">{amountError}</p>}
                  <p className="text-xs text-muted-foreground">Min ₹500 · Max ₹5,00,000</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${method === m ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2.5 leading-relaxed">
                  * Top-up amount is credited to your wallet as-is. Platform fees and GST are debited at campaign approval, not at top-up.
                </p>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleContinue}>Continue to Payment</Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Mock gateway ── */}
          {(step === "gateway" || step === "processing") && (
            <>
              <DialogHeader>
                <DialogTitle>{step === "gateway" ? `Pay via ${method}` : "Processing Payment…"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                {step === "processing" ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Please wait…</p>
                  </div>
                ) : (
                  <>
                    {/* Gateway brand */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Gateway</div>
                        <div className="font-bold text-lg">{method}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Merchant</div>
                        <div className="font-medium">Affordplan</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order ID</span>
                        <span className="font-mono text-xs">{orderId || "Generating…"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-lg text-foreground">₹{parsedAmount.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {/* Simulate failure toggle */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-2">
                      <input type="checkbox" id="simfail" checked={simulateFail} onChange={e => setSimulateFail(e.target.checked)} className="accent-destructive" />
                      <label htmlFor="simfail" className="cursor-pointer">Simulate payment failure (dev)</label>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1" onClick={handleCancel}>Cancel</Button>
                      <Button className="flex-1" onClick={handlePay} disabled={!orderId}>
                        Pay ₹{parsedAmount.toLocaleString("en-IN")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {step === "success" && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Successful</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center gap-2 py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                  <p className="text-sm text-muted-foreground">Your wallet has been credited.</p>
                </div>
                <div className="space-y-2 text-sm bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-mono text-xs">{orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount added</span>
                    <span className="font-semibold text-green-600">+₹{parsedAmount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New balance</span>
                    <span className="font-bold">₹{newBalance.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <Button className="w-full" onClick={handleDone}>Done</Button>
              </div>
            </>
          )}

          {/* ── Step 4: Failed ── */}
          {step === "failed" && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Failed</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center gap-2 py-4">
                  <XCircle className="w-12 h-12 text-red-500" />
                  <p className="text-sm font-medium text-red-700">Payment Failed</p>
                  <p className="text-xs text-muted-foreground text-center">Reason: Insufficient funds (mock)</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setModalOpen(false)}>Close</Button>
              </div>
            </>
          )}

        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
