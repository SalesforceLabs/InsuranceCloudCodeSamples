import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DemoFlowContextType {
  currentStep: number;
  totalSteps: number;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
}

const DemoFlowContext = createContext<DemoFlowContextType | undefined>(undefined);

export const useDemoFlow = () => {
  const context = useContext(DemoFlowContext);
  if (!context) {
    throw new Error('useDemoFlow must be used within a DemoFlowProvider');
  }
  return context;
};

interface DemoFlowProviderProps {
  children: ReactNode;
  totalSteps?: number;
}

export const DemoFlowProvider: React.FC<DemoFlowProviderProps> = ({ children, totalSteps = 10 }) => {
  // Always initialize to 1 so the server render and the client's first render match
  // (the SSR/static HTML has no localStorage). The saved step is loaded post-mount
  // by the effect below, avoiding a hydration mismatch (see CLAUDE.md hydration rule).
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [hydrated, setHydrated] = useState(false);

  // Load the persisted step from localStorage after mount.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStep = localStorage.getItem('demoFlowStep');
      if (savedStep) {
        const parsed = parseInt(savedStep, 10);
        if (!Number.isNaN(parsed)) setCurrentStep(parsed);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Persist step to localStorage — but not before we've read the saved value,
    // or the initial `1` would clobber the persisted step.
    if (typeof window !== 'undefined' && hydrated) {
      localStorage.setItem('demoFlowStep', currentStep.toString());
    }

    // Listen for storage events (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'demoFlowStep' && e.newValue) {
        setCurrentStep(parseInt(e.newValue, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentStep, hydrated]);

  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  return (
    <DemoFlowContext.Provider
      value={{
        currentStep,
        totalSteps,
        goToNextStep,
        goToPreviousStep,
        goToStep,
      }}
    >
      {children}
    </DemoFlowContext.Provider>
  );
};
