import React, { useEffect, useState } from 'react';
import Button from './Button';
import { VIETNAMESE } from '@/constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setIsRendered(false);
    }
  };
  
  if (!isRendered) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            data-state={isOpen ? 'open' : 'closed'}
            onClick={onClose}
            onAnimationEnd={handleAnimationEnd}
        />
        <div
            tabIndex={-1}
            data-state={isOpen ? 'open' : 'closed'}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col text-gray-100 z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
            onAnimationEnd={handleAnimationEnd}
        >
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3 flex-shrink-0">
            <h2 id="modal-title" className="text-2xl font-semibold text-indigo-400">{title}</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              aria-label={VIETNAMESE.closeButton}
              className="text-gray-400 hover:text-white"
              type="button"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
          <div className="text-gray-200 flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
              {children}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end flex-shrink-0">
            <Button variant="secondary" type="button" onClick={onClose}>
                {VIETNAMESE.closeButton}
            </Button>
          </div>
        </div>
    </div>
  );
};

export default Modal;