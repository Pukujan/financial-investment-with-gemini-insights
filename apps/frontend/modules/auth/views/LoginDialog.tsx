import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/shared/api/http';
import { useAuth } from '../controllers/AuthProvider';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LoginDialog({ open, onOpenChange, onSuccess }: LoginDialogProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Signed-in users get a 15-minute cooldown and up to 5 agent runs per day (vs 1 hour
            anonymous).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-dialog-user">Username</Label>
            <Input
              id="login-dialog-user"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-dialog-pass">Password</Label>
            <Input
              id="login-dialog-pass"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
