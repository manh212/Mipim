import React, { useEffect, useState, useRef } from 'react';
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
  const [isRendered, setIsRendered] = useState(isOpen);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Store the element that had focus before the panel opened
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

    const panelElement = panelContentRef.current;
    if (!panelElement) return;
    
    // Focus the close button. A timeout is needed.
    const timer = setTimeout(() => {
      const closeButton = panelElement.querySelector<HTMLElement>(`[aria-label="${VIETNAMESE.closeButton}"]`);
      if (closeButton) {
        closeButton.focus();
      } else {
        panelElement.focus();
      }
    }, 100);

    const handleKeyDown = (event: KeyboardEvent) => {
      // Close on Escape
      if (event.key === 'Escape') {
        onClose();
      }

      // Focus trapping logic
      if (event.key === 'Tab') {
        const focusableElements = panelElement.querySelectorAll<HTMLElement>(
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
  
  const panelPositionClass = position === 'left' ? 'left-0' : 'right-0';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="offcanvas-title">
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            data-state={isOpen ? 'open' : 'closed'}
            onClick={onClose}
            onAnimationEnd={handleAnimationEnd}
        />
        <div
          ref={panelContentRef}
          tabIndex={-1}
          data-position={position}
          data-state={isOpen ? 'open' : 'closed'}
          onAnimationEnd={handleAnimationEnd}
          className={`OffCanvasContent fixed top-0 ${panelPositionClass} h-full w-full max-w-md bg-gray-800 shadow-xl z-50 flex flex-col text-gray-100 focus:outline-none`}
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <h2 id="offcanvas-title" className="text-xl font-semibold text-indigo-400">{title}</h2>
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
          <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
    </div>
  );
};

export default OffCanvasPanel;