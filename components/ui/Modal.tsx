import React, { useEffect, useState, useRef } from 'react';
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
  const modalContentRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Store the element that had focus before the modal opened
      triggerElementRef.current = document.activeElement as HTMLElement;
      // Hide main app content from screen readers
      document.getElementById('root')?.setAttribute('aria-hidden', 'true');
    } else {
       // Un-hide main app content. Focus is handled by onAnimationEnd.
       document.getElementById('root')?.setAttribute('aria-hidden', 'false');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isRendered) return;

    const modalElement = modalContentRef.current;
    if (!modalElement) return;

    // Focus the close button for better accessibility.
    // A timeout is needed to allow the modal to render and animate.
    const timer = setTimeout(() => {
      const closeButton = modalElement.querySelector<HTMLElement>(`[aria-label="${VIETNAMESE.closeButton}"]`);
      if (closeButton) {
        closeButton.focus();
      } else {
        // Fallback to the modal container if the button isn't found for some reason
        modalElement.focus();
      }
    }, 100);
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Close on Escape
      if (event.key === 'Escape') {
        onClose();
      }

      // Focus trapping logic
      if (event.key === 'Tab') {
        const focusableElements = modalElement.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) { // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            event.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRendered, onClose]);

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setIsRendered(false);
      // Restore focus to the trigger element right before unmounting
      triggerElementRef.current?.focus();
    }
  };
  
  if (!isRendered) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            data-state={isOpen ? 'open' : 'closed'}
            onClick={onClose}
            onAnimationEnd={handleAnimationEnd}
        />
        <div
            ref={modalContentRef}
            tabIndex={-1}
            data-state={isOpen ? 'open' : 'closed'}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col text-gray-100 z-[100] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
            onAnimationEnd={handleAnimationEnd}
        >
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3 flex-shrink-0">
            <h2 id="modal-title" tabIndex={-1} className="text-2xl font-semibold text-indigo-400 focus:outline-none">{title}</h2>
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