'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckIcon,
  UserCircleIcon,
  CreditCardIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  ShareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  action: string;
  link: string;
  weight: number;
  field: string;
  completed: boolean;
  isActive: boolean;
  required?: boolean;
  templates?: Array<{ name: string; price: number; description: string }>;
  suggestions?: string[];
}

interface Props {
  steps: SetupStep[];
  onStepComplete?: (stepId: string) => void;
}

const STEP_ICONS: Record<string, any> = {
  profile: UserCircleIcon,
  stripe: CreditCardIcon,
  tier: SparklesIcon,
  content: CloudArrowUpIcon,
  share: ShareIcon,
};

export function SetupChecklist({ steps, onStepComplete }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const getStepIcon = (stepId: string) => {
    const Icon = STEP_ICONS[stepId] || UserCircleIcon;
    return Icon;
  };

  const toggleStep = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  return (
    <div className='space-y-3'>
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.id);
        const isExpanded = expandedStep === step.id;
        const isFirst = index === 0;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative border rounded-xl transition-all duration-300 ${
              step.completed
                ? 'bg-green-50 border-green-200'
                : step.isActive && !step.completed
                  ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                  : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className='p-4 cursor-pointer'
              onClick={() => !step.completed && toggleStep(step.id)}
            >
              <div className='flex items-start'>
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                    step.completed
                      ? 'bg-green-500'
                      : step.isActive
                        ? 'bg-indigo-500'
                        : 'bg-gray-300'
                  }`}
                >
                  {step.completed ? (
                    <CheckIcon className='w-6 h-6 text-white' />
                  ) : (
                    <Icon className='w-6 h-6 text-white' />
                  )}
                </div>

                {/* Content */}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <h3 className='text-sm font-semibold text-gray-900 flex items-center'>
                        {step.title}
                        {step.required && (
                          <span className='ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded'>
                            Required
                          </span>
                        )}
                      </h3>
                      <p className='text-xs text-gray-600 mt-0.5'>{step.description}</p>
                    </div>

                    {/* Action Button */}
                    {!step.completed && (
                      <div className='flex items-center ml-4'>
                        {!isExpanded && (
                          <a
                            href={step.link}
                            onClick={(e) => e.stopPropagation()}
                            className='text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors'
                          >
                            {step.action}
                          </a>
                        )}
                        <button className='ml-2 text-gray-400 hover:text-gray-600'>
                          {isExpanded ? (
                            <ChevronUpIcon className='w-4 h-4' />
                          ) : (
                            <ChevronDownIcon className='w-4 h-4' />
                          )}
                        </button>
                      </div>
                    )}

                    {step.completed && (
                      <span className='text-xs font-medium text-green-600 ml-4'>Complete</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && !step.completed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className='px-4 pb-4 border-t border-indigo-200'
              >
                <div className='pt-4'>
                  {/* Templates for tier step */}
                  {step.id === 'tier' && step.templates && (
                    <div>
                      <p className='text-xs font-medium text-gray-700 mb-2'>
                        Quick Start Templates:
                      </p>
                      <div className='grid grid-cols-3 gap-2'>
                        {step.templates.map(template => (
                          <button
                            key={template.name}
                            onClick={() => {
                              // In a real implementation, this would populate the tier creation form
                              window.location.href = `${step.link}?template=${template.name}&price=${template.price}`;
                            }}
                            className='text-left p-3 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 hover:shadow-sm transition-all'
                          >
                            <div className='text-sm font-semibold text-gray-900'>
                              {template.name}
                            </div>
                            <div className='text-lg font-bold text-indigo-600 mt-1'>
                              ${template.price}/mo
                            </div>
                            <div className='text-xs text-gray-600 mt-1'>{template.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions for content step */}
                  {step.id === 'content' && step.suggestions && (
                    <div>
                      <p className='text-xs font-medium text-gray-700 mb-2'>
                        Content Ideas to Get Started:
                      </p>
                      <ul className='space-y-1'>
                        {step.suggestions.map(suggestion => (
                          <li key={suggestion} className='flex items-start text-xs text-gray-600'>
                            <span className='text-indigo-600 mr-2'>•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action button */}
                  <a
                    href={step.link}
                    className='mt-4 inline-flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors'
                  >
                    {step.action}
                  </a>
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
