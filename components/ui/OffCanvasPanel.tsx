

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Button from './Button';
import { VIETNAMESE } from '@/constants';

interface OffCanvasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
}

const OffCanvasPanel: React.FC<OffCanvasPanelProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  position = 'right' 
}) => {
  
  const panelPositionClass = position === 'left' ? 'left-0' : 'right-0';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-60 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content 
          data-position={position}
          className={`OffCanvasContent fixed top-0 ${panelPositionClass} h-full w-full max-w-md bg-gray-800 shadow-xl z-50 flex flex-col text-gray-100 focus:outline-none`}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <Dialog.Title id="offcanvas-title" className="text-xl font-semibold text-indigo-400">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                aria-label={VIETNAMESE.closeButton}
                className="text-gray-400 hover:text-white"
                type="button"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </Dialog.Close>
          </div>
          <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default OffCanvasPanel;