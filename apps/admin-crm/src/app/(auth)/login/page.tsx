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
  Input,
  Label,
} from '@ac/ui';

import { authApi } from '@/lib/api/auth';
import { setAccessToken, setRefreshToken } from '@/lib/api/auth-token';
import { setStoredPermissionVersion } from '@/lib/rbac/permissions';

const IS_DEV = process.env.NEXT_PUBLIC_APP_ENV === 'development';
const DEV_PHONE = '+919876543210';

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

  const [phone, setPhone] = useState(IS_DEV ? DEV_PHONE : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
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
      setSentTo(res.sentTo);
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">A</span>
        AC Admin
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-lg font-semibold leading-none tracking-tight">
            {otpRequested ? 'Enter your code' : 'Sign in'}
          </h1>
          <CardDescription>
            {otpRequested ? (
              <>We sent a one-time code to {sentTo ?? destination}.</>
            ) : (
              <>Operations team access. We&apos;ll text a one-time code to your phone.</>
            )}
            {IS_DEV && !otpRequested ? (
              <span className="mt-1 block">
                Local dev: seed phone <strong className="font-medium text-foreground">{DEV_PHONE}</strong>
              </span>
            ) : null}
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
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Sending code…' : 'Send code'}
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
                <Label htmlFor="otp">One-time code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  pattern="\d{4,8}"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                {devCode ? (
                  <p className="text-xs text-muted-foreground">
                    Dev mode: code <code className="rounded bg-muted px-1 font-mono">{devCode}</code> was prefilled.
                  </p>
                ) : null}
              </div>
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOtpRequested(false);
                    setDevCode(null);
                    setOtp('');
                  }}
                >
                  Change number
                </Button>
                <Button type="button" variant="ghost" disabled={loading} onClick={() => void requestOtp()}>
                  Resend code
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
