import React from 'react';
import { useDemoFlow } from '@/contexts/DemoFlowContext';
import { Button, Icon } from '@salesforce/design-system-react';

interface DemoFlowControllerProps {
  showErrorToggle?: boolean;
  errorChecked?: boolean;
  onErrorToggle?: (checked: boolean) => void;
}

export const DemoFlowController: React.FC<DemoFlowControllerProps> = ({
  showErrorToggle = false,
  errorChecked = false,
  onErrorToggle,
}) => {
  const { currentStep, totalSteps, goToNextStep, goToPreviousStep } = useDemoFlow();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#032D60',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 10000,
      }}
    >
      {/* Error-state toggle (step 1 only) */}
      {showErrorToggle && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'white',
            cursor: 'pointer',
            paddingRight: '10px',
            marginRight: '4px',
            borderRight: '1px solid #0d3f6e',
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="checkbox"
            checked={errorChecked}
            onChange={(e) => onErrorToggle?.(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Error state
        </label>
      )}

      {/* Previous Button */}
      <button
        onClick={goToPreviousStep}
        disabled={currentStep === 1}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: currentStep === 1 ? '#5c5c5c' : '#0176D3',
          cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (currentStep !== 1) {
            e.currentTarget.style.backgroundColor = '#014a8f';
          }
        }}
        onMouseLeave={(e) => {
          if (currentStep !== 1) {
            e.currentTarget.style.backgroundColor = '#0176D3';
          }
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="white"
          style={{ opacity: currentStep === 1 ? 0.5 : 1 }}
        >
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      {/* Step Counter */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '60px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: '#C9C9C9',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '2px',
          }}
        >
          Demo Step
        </span>
        <span
          style={{
            fontSize: '18px',
            color: 'white',
            fontWeight: 700,
          }}
        >
          {currentStep} / {totalSteps}
        </span>
      </div>

      {/* Next Button */}
      <button
        onClick={goToNextStep}
        disabled={currentStep === totalSteps}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: currentStep === totalSteps ? '#5c5c5c' : '#0176D3',
          cursor: currentStep === totalSteps ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (currentStep !== totalSteps) {
            e.currentTarget.style.backgroundColor = '#014a8f';
          }
        }}
        onMouseLeave={(e) => {
          if (currentStep !== totalSteps) {
            e.currentTarget.style.backgroundColor = '#0176D3';
          }
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="white"
          style={{ opacity: currentStep === totalSteps ? 0.5 : 1 }}
        >
          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
        </svg>
      </button>
    </div>
  );
};
