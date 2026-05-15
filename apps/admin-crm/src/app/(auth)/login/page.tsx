'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ac/ui';

import { authApi } from '@/lib/api/auth';
import { setAccessToken, setRefreshToken } from '@/lib/api/auth-token';
import { setStoredPermissionVersion } from '@/lib/rbac/permissions';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (raw.startsWith('+')) return raw;
  return `+${digits}`;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/leads';

  const [phone, setPhone] = useState('+919876543210');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const destination = normalizePhone(phone);

  const requestOtp = async () => {
    setLoading(true);
    try {
      const res = await authApi.requestOtp(destination);
      setOtpRequested(true);
      if (res.devCode) {
        setDevCode(res.devCode);
        setOtp(res.devCode);
        toast.message('Development OTP', {
          description: `Code ${res.devCode} was prefilled. Check API logs if needed.`,
        });
      } else {
        toast.success(`OTP sent to ${res.sentTo}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(destination, otp);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setStoredPermissionVersion(res.permissionVersion);
      toast.success(`Welcome back${res.user.firstName ? `, ${res.user.firstName}` : ''}`);
      router.replace(next.startsWith('/') ? next : '/leads');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Operations team access. Use seed phone <strong>+919876543210</strong> in local dev.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!otpRequested ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void requestOtp();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyOtp();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                {devCode ? (
                  <p className="text-xs text-muted-foreground">
                    Dev mode: OTP <code className="rounded bg-muted px-1">{devCode}</code>
                  </p>
                ) : null}
              </div>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => {
                  setOtpRequested(false);
                  setDevCode(null);
                  setOtp('');
                }}
              >
                Change phone
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
