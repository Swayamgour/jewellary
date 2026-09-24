import React, { useState } from 'react';
import { Briefcase, Plus, Search, Phone, Building } from 'lucide-react';
import { useGetVendorsQuery, useCreateVendorMutation } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'sonner';

export const VendorListPage = () => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: vendorData, isLoading } = useGetVendorsQuery({ search });
  const [createVendor, { isLoading: isCreating }] = useCreateVendorMutation();

  const vendors = vendorData?.data || [];

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    mobile: '',
    email: '',
    gstin: '',
    street: '',
    city: 'Surat',
    state: 'Gujarat',
    stateCode: '24',
    pincode: '395002'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.company) {
      toast.error('Contact Name and Company Name are required');
      return;
    }

    try {
      await createVendor({
        name: formData.name,
        company: formData.company,
        mobile: formData.mobile || undefined,
        email: formData.email || undefined,
        gstin: formData.gstin || undefined,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          stateCode: formData.stateCode,
          pincode: formData.pincode
        }
      }).unwrap();

      toast.success('Wholesale vendor account registered successfully');
      setModalOpen(false);
      setFormData({
        name: '',
        company: '',
        mobile: '',
        email: '',
        gstin: '',
        street: '',
        city: 'Surat',
        state: 'Gujarat',
        stateCode: '24',
        pincode: '395002'
      });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create vendor');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Wholesale Vendors & Karigars</h1>
          <p className="text-xs text-surface-500 mt-1">
            Supplier accounts, bullion refinery houses, manufacturing partners, and payable balances
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
          className="font-bold shadow-sm"
        >
          Add Wholesale Supplier
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search vendors by company, contact person or GSTIN..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No Vendors Recorded"
            description="Add bullion suppliers and karigar workshops to track wholesale procurement."
            actionLabel="Add Vendor"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <Table
            headers={[
              'Company / Workshop',
              'Contact Person',
              'Mobile',
              'Location',
              'GSTIN',
              { label: 'Payable Balance', align: 'right' }
            ]}
          >
            {vendors.map((v) => (
              <TableRow key={v._id}>
                <TableCell className="font-bold text-surface-900">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-gold-600" />
                    <span>{v.company || v.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-surface-700 font-medium">{v.name}</TableCell>
                <TableCell className="text-surface-600">📞 {v.mobile || '-'}</TableCell>
                <TableCell className="text-surface-500">
                  {v.address?.city || 'Surat'}, {v.address?.state || 'GJ'}
                </TableCell>
                <TableCell className="font-mono text-surface-600">{v.gstin || '-'}</TableCell>
                <TableCell
                  align="right"
                  className={`font-bold ${
                    v.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(v.currentBalance || 0)}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Wholesale Vendor / Bullion Supplier"
        subtitle="Register vendor profile for stock purchases and ledger tracking"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Company / Firm Name *"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="e.g. Surat Bullion Wholesale"
              required
            />
            <Input
              label="Contact Person Name *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Mukeshbhai Choksi"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Mobile Number"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="9822114455"
            />
            <Input
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="sales@vendor.com"
            />
            <Input
              label="GSTIN"
              name="gstin"
              value={formData.gstin}
              onChange={handleChange}
              placeholder="24BBBBB1111B1Z9"
            />
          </div>

          <div className="pt-2 border-t border-surface-100">
            <p className="text-[11px] font-bold uppercase text-surface-500 mb-2">Address</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input label="City" name="city" value={formData.city} onChange={handleChange} />
              <Input label="State" name="state" value={formData.state} onChange={handleChange} />
              <Input label="State Code" name="stateCode" value={formData.stateCode} onChange={handleChange} />
              <Input label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreating}>
              Save Vendor Profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
