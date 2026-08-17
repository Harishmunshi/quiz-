'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import type { AdminLoginResponse } from '@/types/competition';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

// ── Main Component ──────────────────────────────────────────────
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAdmin = useAppStore((s) => s.setAdmin);
  const navigate = useAppStore((s) => s.navigate);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json: AdminLoginResponse = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Login failed. Please check your credentials.');
        return;
      }

      if (json.token && json.adminName) {
        setAdmin(json.token, json.adminName);
        // Persist so the standalone /admin/round2 control panel — a separate
        // page with its own React tree — can authenticate without a second login.
        try {
          window.localStorage.setItem('mes-admin-token', json.token);
        } catch {
          /* private browsing: the in-memory store still covers this tab */
        }
        navigate('admin-dashboard');
      } else {
        setError('Invalid response from server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('landing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 islamic-pattern">
      <motion.div
        className="w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Login Card */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/60 shadow-xl overflow-hidden">
            {/* Emerald header bar */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-deep via-emerald-mid to-emerald-deep" />

            <CardHeader className="text-center pb-2 pt-6 px-6">
              <motion.div
                className="mx-auto w-16 h-16 rounded-2xl bg-emerald-deep flex items-center justify-center mb-4 gold-glow"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring' as const, stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <Shield className="w-8 h-8 text-gold-accent" />
              </motion.div>
              <CardTitle className="text-2xl font-bold text-foreground tracking-tight">
                Admin Login
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Access the competition control panel
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <label
                    htmlFor="admin-email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="pl-10 h-11 border-border focus:border-emerald-deep focus:ring-emerald-deep/20"
                      disabled={loading}
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <label
                    htmlFor="admin-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pl-10 pr-10 h-11 border-border focus:border-emerald-deep focus:ring-emerald-deep/20"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Error Display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
                  >
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.div variants={itemVariants}>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-emerald-deep hover:bg-emerald-deep/90 text-ivory-warm font-semibold text-sm transition-all"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Sign In to Dashboard
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom link */}
        <motion.div variants={itemVariants} className="text-center mt-4">
          <Button
            variant="link"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-gold-accent gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Competition Home
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}