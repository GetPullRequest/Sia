'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLogoutFunction } from '@propelauth/react';

interface LogoutIndicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogoutIndicationModal = ({
  isOpen,
  onClose,
}: LogoutIndicationModalProps) => {
  const logout = useLogoutFunction();

  const handleConfirmLogout = async () => {
    try {
      await logout(false);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out</DialogTitle>
          <DialogDescription>
            Are you sure you want to log out? You&apos;ll need to sign in again
            to access your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmLogout}>
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
