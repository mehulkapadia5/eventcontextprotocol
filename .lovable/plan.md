

## Admin Logs Page

Add a new "Logs" section to the admin panel that displays both **credit transactions** and **payment orders** in a tabbed view.

### Changes

1. **Create `src/components/admin/AdminLogs.tsx`** — New component with two tabs:
   - **Credit Transactions tab**: Table showing all `credit_transactions` records joined with profile display names. Columns: User, Amount, Reason, Admin (if admin-granted), Date. Sorted by most recent.
   - **Payment Orders tab**: Table showing all `payment_orders` records joined with profile display names. Columns: User, Plan, Amount (₹), Credits, Status (badge), Razorpay Order ID, Payment ID, Date. Sorted by most recent.
   - Search filter for user name and status filter for payment orders.

2. **Update `src/pages/Admin.tsx`**:
   - Add "Logs" nav item with a `ScrollText` icon in the sidebar
   - Add route `path="logs"` pointing to `AdminLogs`

### No database changes required
Both `credit_transactions` and `payment_orders` tables already have admin SELECT RLS policies in place.

