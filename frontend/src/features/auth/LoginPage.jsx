import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Coins, Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useLoginMutation } from '../../app/api/baseApi';
import { setCredentials } from './authSlice';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in both email and password');
      return;
    }

    try {
      const res = await login({ email, password }).unwrap();
      if (res.success && res.data) {
        dispatch(
          setCredentials({
            user: res.data.user,
            token: res.data.token
          })
        );
        toast.success(`Welcome back, ${res.data.user.name}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleDemoLogin = async () => {
    setEmail('admin@jewelleryerp.com');
    setPassword('Admin@12345');
    try {
      const res = await login({
        email: 'admin@jewelleryerp.com',
        password: 'Admin@12345'
      }).unwrap();
      if (res.success && res.data) {
        dispatch(
          setCredentials({
            user: res.data.user,
            token: res.data.token
          })
        );
        toast.success(`Logged in as Super Administrator`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Demo login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] p-4 relative overflow-hidden">
      {/* Decorative luxury background accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gold-200/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gold-300/30 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-3xl border border-surface-200 shadow-luxury p-8 sm:p-10 z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg shadow-gold-500/30 mb-4">
            <Coins className="w-8 h-8 text-surface-950" />
          </div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight font-display">AURA JEWEL</h1>
          <p className="text-xs uppercase font-bold tracking-widest text-gold-700 mt-1">
            Enterprise Jewellery POS & ERP
          </p>
        </div>

        {/* Demo Login Quick Fill Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gold-50/80 border border-gold-200/80 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gold-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" /> Demo Admin Access
            </span>
            <span className="text-[10px] bg-gold-200/80 text-gold-900 font-semibold px-2 py-0.5 rounded-full">
              Pre-seeded
            </span>
          </div>
          <p className="text-surface-600 text-[11px] mb-3">
            Click below for 1-click login as Master Administrator (Full permissions).
          </p>
          <Button
            type="button"
            variant="goldSoft"
            size="sm"
            onClick={handleDemoLogin}
            isLoading={isLoading}
            className="w-full text-xs font-bold"
          >
            1-Click Demo Login
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="admin@jewelleryerp.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            icon={Lock}
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            icon={ArrowRight}
            className="w-full mt-2 font-bold tracking-wide"
          >
            Sign In to ERP
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-surface-100 flex items-center justify-center gap-2 text-xs text-surface-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role-Based Access Control · TLS Protected</span>
        </div>
      </div>
    </div>
  );
};
