import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useCreateCustomerMutation } from '../../app/api/baseApi';
import { toast } from 'sonner';

export const CustomerSelectModal = ({ isOpen, onClose, onCustomerCreated }) => {
  const [createCustomer, { isLoading }] = useCreateCustomerMutation();

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    pan: '',
    street: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '400001'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) {
      toast.error('Name and Mobile number are required');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email || undefined,
        gstin: formData.gstin || undefined,
        pan: formData.pan || undefined,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          stateCode: formData.stateCode,
          pincode: formData.pincode
        }
      };

      const res = await createCustomer(payload).unwrap();
      toast.success('Customer profile created successfully!');
      if (onCustomerCreated && res.data) {
        onCustomerCreated(res.data);
      }
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create customer');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      subtitle="Register a new customer for POS billing and ledger tracking"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Customer Full Name *"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Rajesh Sharma"
            required
          />
          <Input
            label="Mobile Number *"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            placeholder="e.g. 9876543210"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
          />
          <Input
            label="GSTIN (Optional)"
            name="gstin"
            value={formData.gstin}
            onChange={handleChange}
            placeholder="27AAAAA0000A1Z5"
          />
          <Input
            label="PAN Number"
            name="pan"
            value={formData.pan}
            onChange={handleChange}
            placeholder="ABCDE1234F"
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-surface-100">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Address Details</p>
          <Input
            label="Street Address"
            name="street"
            value={formData.street}
            onChange={handleChange}
            placeholder="Flat / Shop No, Building name"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
            <Input
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
            />
            <Input
              label="State Code"
              name="stateCode"
              value={formData.stateCode}
              onChange={handleChange}
            />
            <Input
              label="Pincode"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={UserPlus}>
            Save & Select Customer
          </Button>
        </div>
      </form>
    </Modal>
  );
};
