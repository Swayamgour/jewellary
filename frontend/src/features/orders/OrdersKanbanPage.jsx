import React, { useState } from 'react';
import { Clock, Plus, User, ArrowRight, CheckCircle2, Hammer, ShieldAlert } from 'lucide-react';
import {
  useGetOrdersQuery,
  useCreateOrderMutation,
  useUpdateOrderStatusMutation,
  useAssignKarigarMutation,
  useGetCustomersQuery
} from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatWeight, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

const STATUS_COLUMNS = [
  { id: 'NEW', title: 'New Orders', color: 'border-blue-400 bg-blue-50/20' },
  { id: 'CONFIRMED', title: 'Confirmed & Advance', color: 'border-amber-400 bg-amber-50/20' },
  { id: 'MANUFACTURING', title: 'With Karigar (Workshop)', color: 'border-purple-400 bg-purple-50/20' },
  { id: 'QC', title: 'Quality Control', color: 'border-sky-400 bg-sky-50/20' },
  { id: 'READY', title: 'Ready for Delivery', color: 'border-emerald-400 bg-emerald-50/20' },
  { id: 'DELIVERED', title: 'Delivered to Customer', color: 'border-surface-300 bg-surface-50/20' }
];

export const OrdersKanbanPage = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [karigarModalOpen, setKarigarModalOpen] = useState(false);
  const [selectedOrderForKarigar, setSelectedOrderForKarigar] = useState(null);

  const { data: orderData, isLoading } = useGetOrdersQuery();
  const { data: custData } = useGetCustomersQuery();

  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [assignKarigar, { isLoading: isAssigning }] = useAssignKarigarMutation();

  const orders = orderData?.data || [];
  const customers = custData?.data || [];

  // Create Order Form State
  const [customerId, setCustomerId] = useState('');
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [designName, setDesignName] = useState('Custom Antique Gold Bridal Set');
  const [estimatedGrossWeight, setEstimatedGrossWeight] = useState('35.0');
  const [estimatedNetWeight, setEstimatedNetWeight] = useState('32.0');
  const [goldRateLocked, setGoldRateLocked] = useState('7195');
  const [totalEstimatedAmount, setTotalEstimatedAmount] = useState('245000');
  const [advancePaid, setAdvancePaid] = useState('50000');
  const [specialInstructions, setSpecialInstructions] = useState('High polish matte finish, 2.6 bangle size');

  // Karigar State
  const [karigarName, setKarigarName] = useState('');
  const [karigarPhone, setKarigarPhone] = useState('');
  const [karigarMakingCharges, setKarigarMakingCharges] = useState('');

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const activeCustomerId = customerId || customers[0]?._id;
    if (!activeCustomerId) {
      toast.error('Please select customer');
      return;
    }

    try {
      const payload = {
        customerId: activeCustomerId,
        expectedDeliveryDate: new Date(expectedDate),
        items: [
          {
            designName,
            metal: 'GOLD',
            purity: '22K',
            estimatedGrossWeight: parseFloat(estimatedGrossWeight),
            estimatedNetWeight: parseFloat(estimatedNetWeight),
            goldRateLocked: parseFloat(goldRateLocked),
            estimatedTotalAmount: parseFloat(totalEstimatedAmount),
            specialInstructions
          }
        ],
        totalEstimatedAmount: parseFloat(totalEstimatedAmount),
        advancePaid: parseFloat(advancePaid) || 0,
        notes: specialInstructions
      };

      await createOrder(payload).unwrap();
      toast.success('Custom manufacturing order created!');
      setCreateModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create order');
    }
  };

  const handleAdvanceStatus = async (order, nextStatus) => {
    try {
      await updateOrderStatus({
        id: order._id,
        status: nextStatus,
        remarks: `Advanced status to ${nextStatus}`
      }).unwrap();
      toast.success(`Order moved to ${nextStatus}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update order status');
    }
  };

  const handleKarigarSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderForKarigar) return;

    try {
      await assignKarigar({
        id: selectedOrderForKarigar._id,
        karigarName,
        karigarPhone: karigarPhone || undefined,
        makingCharges: parseFloat(karigarMakingCharges) || 0
      }).unwrap();
      toast.success(`Assigned to Karigar ${karigarName}`);
      setKarigarModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to assign karigar');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">
            Custom Manufacturing & Orders
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Kanban workflow from initial customer design specs to karigar manufacturing, QC, and delivery
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setCreateModalOpen(true)}
          className="font-bold shadow-sm"
        >
          New Custom Order
        </Button>
      </div>

      {/* Kanban Board Horizontal Scroll Container */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex-shrink-0 w-72 rounded-2xl border-t-4 bg-white p-3 border border-surface-200 shadow-xs flex flex-col max-h-[75vh] ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-surface-100 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-surface-800">
                  {col.title}
                </span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-surface-100 text-surface-700">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards in this column */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {colOrders.map((order) => {
                  const item = order.items?.[0] || {};
                  const balance = (order.totalEstimatedAmount || 0) - (order.advancePaid || 0);

                  return (
                    <div
                      key={order._id}
                      className="p-3.5 rounded-xl border border-surface-200 bg-white shadow-xs hover:shadow-md transition-all space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-surface-900 text-[11px]">
                          {order.orderNo || order._id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-surface-400 font-semibold">
                          Due: {formatDate(order.expectedDeliveryDate)}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-surface-900 leading-tight">
                          {item.designName || 'Custom Jewellery'}
                        </h4>
                        <p className="text-[11px] text-surface-500 mt-0.5">
                          {order.customerId?.name || 'Customer'}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-surface-600 pt-1 border-t border-surface-100">
                        <span>Est Wt: {formatWeight(item.estimatedNetWeight || 0)}</span>
                        <span className="font-bold text-surface-900 font-display">
                          {formatCurrency(order.totalEstimatedAmount)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-surface-500">
                        <span>Adv: {formatCurrency(order.advancePaid || 0)}</span>
                        <span className="font-bold text-amber-600">Due: {formatCurrency(balance)}</span>
                      </div>

                      {order.karigar?.name && (
                        <div className="p-1.5 rounded-md bg-purple-50 text-purple-900 text-[10px] font-semibold flex items-center gap-1">
                          <Hammer className="w-3 h-3 text-purple-600" />
                          <span>Karigar: {order.karigar.name}</span>
                        </div>
                      )}

                      {/* Action buttons depending on state */}
                      <div className="pt-2 border-t border-surface-100 flex items-center justify-between gap-1">
                        {order.status === 'NEW' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(order, 'CONFIRMED')}
                            className="w-full text-center py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px]"
                          >
                            Confirm Order →
                          </button>
                        )}
                        {order.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForKarigar(order);
                              setKarigarModalOpen(true);
                            }}
                            className="w-full text-center py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-[10px]"
                          >
                            Assign Karigar 🔨
                          </button>
                        )}
                        {order.status === 'MANUFACTURING' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(order, 'QC')}
                            className="w-full text-center py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[10px]"
                          >
                            Send to QC →
                          </button>
                        )}
                        {order.status === 'QC' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(order, 'READY')}
                            className="w-full text-center py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px]"
                          >
                            Pass QC & Ready ✓
                          </button>
                        )}
                        {order.status === 'READY' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(order, 'DELIVERED')}
                            className="w-full text-center py-1 rounded bg-surface-800 text-white hover:bg-surface-900 font-bold text-[10px]"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colOrders.length === 0 && (
                  <div className="text-center py-8 text-[11px] text-surface-400">
                    No orders in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Custom Jewellery Order"
        subtitle="Record custom design specification, estimated weight, delivery date and advance token"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Customer *</label>
              <select
                value={customerId || (customers[0]?._id || '')}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
                required
              >
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} (📞 {c.mobile})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Expected Delivery Date *"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Jewellery Design Name *"
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder="e.g. 22K Peacock Bridal Choker"
            required
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Est. Gross Wt (g)"
              type="number"
              step="0.01"
              value={estimatedGrossWeight}
              onChange={(e) => setEstimatedGrossWeight(e.target.value)}
              required
            />
            <Input
              label="Est. Net Wt (g)"
              type="number"
              step="0.01"
              value={estimatedNetWeight}
              onChange={(e) => setEstimatedNetWeight(e.target.value)}
              required
            />
            <Input
              label="Locked Gold Rate"
              type="number"
              value={goldRateLocked}
              onChange={(e) => setGoldRateLocked(e.target.value)}
              required
            />
            <Input
              label="Total Est. Value (₹)"
              type="number"
              value={totalEstimatedAmount}
              onChange={(e) => setTotalEstimatedAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Advance Token Received (₹)"
              type="number"
              value={advancePaid}
              onChange={(e) => setAdvancePaid(e.target.value)}
            />
            <Input
              label="Special Crafting Instructions"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Antique polish, rhodium highlights"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreating}>
              Create Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Karigar Modal */}
      {selectedOrderForKarigar && (
        <Modal
          isOpen={karigarModalOpen}
          onClose={() => setKarigarModalOpen(false)}
          title={`Assign Order ${selectedOrderForKarigar.orderNo} to Karigar`}
          subtitle="Assign jewellery smith workshop and advance status to MANUFACTURING"
        >
          <form onSubmit={handleKarigarSubmit} className="space-y-4 text-xs">
            <Input
              label="Karigar / Artisan Name *"
              value={karigarName}
              onChange={(e) => setKarigarName(e.target.value)}
              placeholder="e.g. Ramesh Babubhai Soni"
              required
            />
            <Input
              label="Karigar Phone / Mobile"
              value={karigarPhone}
              onChange={(e) => setKarigarPhone(e.target.value)}
              placeholder="9820011223"
            />
            <Input
              label="Agreed Karigar Making Charges (₹)"
              type="number"
              value={karigarMakingCharges}
              onChange={(e) => setKarigarMakingCharges(e.target.value)}
              placeholder="e.g. 4500"
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
              <Button variant="outline" type="button" onClick={() => setKarigarModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isAssigning} icon={Hammer}>
                Assign & Move to Workshop
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
