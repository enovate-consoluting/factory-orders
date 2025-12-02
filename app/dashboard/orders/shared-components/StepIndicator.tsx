/**
 * Step Indicator Component
 * Shows progress through multi-step forms
 * Allows navigation between completed steps
 * Last Modified: November 2025
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface Step {
  number: number;
  label: string;
  completed: boolean;
  active: boolean;
}

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  canNavigate?: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  onStepClick,
  canNavigate = true
}) => {
  const { t } = useTranslation();

  const steps: Step[] = [
    { number: 1, label: t('basicInfo'), completed: currentStep > 1, active: currentStep === 1 },
    { number: 2, label: t('addProducts'), completed: currentStep > 2, active: currentStep === 2 },
    { number: 3, label: t('configureProducts'), completed: false, active: currentStep === 3 }
  ];

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div
            className={`flex items-center ${
              canNavigate && (step.completed || step.active) ? 'cursor-pointer' : ''
            } ${step.completed || step.active ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => {
              if (canNavigate && onStepClick && (step.completed || step.active)) {
                onStepClick(step.number);
              }
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step.completed || step.active ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              {step.number}
            </div>
            <span className="ml-2 font-medium">{step.label}</span>
          </div>
          
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 bg-gray-300 mx-4" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};