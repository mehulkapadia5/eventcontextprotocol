import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

type Profile = { user_id: string; display_name: string | null };

export function AdminLogs() {
  const [credits, setCredits] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: ct }, { data: po }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name"),
        supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("payment_orders").select("*").order("created_at", { ascending: false }),
      ]);
      const map = new Map<string, string>();
      (p as Profile[] || []).forEach((pr) => map.set(pr.user_id, pr.display_name || pr.user_id.slice(0, 8)));
      setProfiles(map);
      setCredits(ct || []);
      setPayments(po || []);
      setLoading(false);
    }
    load();
  }, []);

  const userName = (uid: string) => profiles.get(uid) || uid.slice(0, 8);

  const filteredCredits = credits.filter((c) =>
    userName(c.user_id).toLowerCase().includes(search.toLowerCase())
  );

  const filteredPayments = payments.filter((p) => {
    const nameMatch = userName(p.user_id).toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || p.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const statusVariant = (s: string) => {
    if (s === "paid") return "default";
    if (s === "failed") return "destructive";
    return "secondary";
  };

  if (loading) return <div className="text-muted-foreground p-8">Loading logs...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Logs</h2>
      <Input placeholder="Search by user name..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Tabs defaultValue="credits">
        <TabsList>
          <TabsTrigger value="credits">Credit Transactions ({filteredCredits.length})</TabsTrigger>
          <TabsTrigger value="payments">Payment Orders ({filteredPayments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="credits">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCredits.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{userName(c.user_id)}</TableCell>
                  <TableCell className={c.amount > 0 ? "text-green-600" : "text-destructive"}>{c.amount > 0 ? `+${c.amount}` : c.amount}</TableCell>
                  <TableCell>{c.reason}</TableCell>
                  <TableCell>{c.admin_id ? userName(c.admin_id) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
              {filteredCredits.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transactions found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="payments">
          <div className="mb-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{userName(p.user_id)}</TableCell>
                  <TableCell>{p.plan_id}</TableCell>
                  <TableCell>₹{(p.amount_paise / 100).toFixed(2)}</TableCell>
                  <TableCell>{p.credits}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p.razorpay_order_id}</TableCell>
                  <TableCell className="font-mono text-xs">{p.razorpay_payment_id || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
              {filteredPayments.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No orders found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
