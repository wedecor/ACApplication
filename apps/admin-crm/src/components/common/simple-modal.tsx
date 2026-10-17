'use client';

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@ac/ui';
import * as React from 'react';

/** Thin wrapper over the @ac/ui Modal primitives for controlled dialogs. */
export function SimpleModal({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className={className ?? 'max-w-xl'}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          {description ? <ModalDescription>{description}</ModalDescription> : null}
        </ModalHeader>
        {children}
      </ModalContent>
    </Modal>
  );
}
