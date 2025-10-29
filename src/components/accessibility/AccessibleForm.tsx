'use client';

import React, { useId, useState, useCallback, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  X,
  ChevronDown,
  Calendar,
  Upload
} from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useScreenReader, useAriaUtilities } from '@/hooks/useAccessibilityHooks';

interface BaseInputProps {
  id?: string;
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

interface AccessibleInputProps extends BaseInputProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number';
  showPasswordToggle?: boolean;
}

interface AccessibleTextareaProps extends BaseInputProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  autoResize?: boolean;
}

interface AccessibleSelectProps extends BaseInputProps, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

interface AccessibleCheckboxProps extends BaseInputProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  indeterminate?: boolean;
}

interface AccessibleRadioGroupProps extends BaseInputProps {
  name: string;
  options: Array<{ value: string; label: string; disabled?: boolean; description?: string }>;
  value?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

// Accessible Input Component
export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(({
  id,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  type = 'text',
  showPasswordToggle = false,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  
  const { settings } = useAccessibility();
  const { announceFormError } = useScreenReader();
  const { getAriaProps } = useAriaUtilities();

  const inputType = type === 'password' && showPassword ? 'text' : type;
  
  const describedByIds = [
    ariaDescribedBy,
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ');

  const ariaProps = getAriaProps({
    required,
    invalid: !!error,
    description: helperText
  });

  useEffect(() => {
    if (error && focused) {
      announceFormError(label, error);
    }
  }, [error, label, announceFormError, focused]);

  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return (
    <div className={`space-y-1 ${className}`}>
      <label
        htmlFor={inputId}
        className={`block text-sm font-medium ${
          error ? 'text-red-700' : 'text-gray-700'
        } ${settings.highContrast ? 'font-bold' : ''}`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          disabled={disabled}
          required={required}
          aria-describedby={describedByIds || undefined}
          aria-invalid={!!error}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            transition-colors duration-200
            ${error 
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300 placeholder-gray-400'
            }
            ${disabled 
              ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
              : 'bg-white'
            }
            ${settings.highContrast ? 'border-2' : ''}
            ${settings.largeText ? 'text-lg py-3' : ''}
          `}
          {...props}
          {...ariaProps}
        />

        {/* Password Toggle */}
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            onClick={togglePassword}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-1 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {helperText && !error && (
        <div
          id={helperId}
          className="flex items-center space-x-1 text-sm text-gray-600"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </div>
  );
});

AccessibleInput.displayName = 'AccessibleInput';

// Accessible Textarea Component
export const AccessibleTextarea = forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(({
  id,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  autoResize = false,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;
  
  const [focused, setFocused] = useState(false);
  
  const { settings } = useAccessibility();
  const { announceFormError } = useScreenReader();

  const describedByIds = [
    ariaDescribedBy,
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (error && focused) {
      announceFormError(label, error);
    }
  }, [error, label, announceFormError, focused]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (autoResize) {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    }
    props.onChange?.(e);
  }, [autoResize, props.onChange]);

  return (
    <div className={`space-y-1 ${className}`}>
      <label
        htmlFor={textareaId}
        className={`block text-sm font-medium ${
          error ? 'text-red-700' : 'text-gray-700'
        } ${settings.highContrast ? 'font-bold' : ''}`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </label>

      <textarea
        ref={ref}
        id={textareaId}
        disabled={disabled}
        required={required}
        aria-describedby={describedByIds || undefined}
        aria-invalid={!!error}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleInput}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm
          focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          transition-colors duration-200 resize-vertical
          ${error 
            ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 placeholder-gray-400'
          }
          ${disabled 
            ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
            : 'bg-white'
          }
          ${settings.highContrast ? 'border-2' : ''}
          ${settings.largeText ? 'text-lg py-3' : ''}
          ${autoResize ? 'resize-none overflow-hidden' : ''}
        `}
        {...props}
      />

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-1 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {helperText && !error && (
        <div
          id={helperId}
          className="flex items-center space-x-1 text-sm text-gray-600"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </div>
  );
});

AccessibleTextarea.displayName = 'AccessibleTextarea';

// Accessible Select Component
export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(({
  id,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  options,
  placeholder,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;
  
  const [focused, setFocused] = useState(false);
  
  const { settings } = useAccessibility();
  const { announceFormError } = useScreenReader();

  const describedByIds = [
    ariaDescribedBy,
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (error && focused) {
      announceFormError(label, error);
    }
  }, [error, label, announceFormError, focused]);

  return (
    <div className={`space-y-1 ${className}`}>
      <label
        htmlFor={selectId}
        className={`block text-sm font-medium ${
          error ? 'text-red-700' : 'text-gray-700'
        } ${settings.highContrast ? 'font-bold' : ''}`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </label>

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          aria-describedby={describedByIds || undefined}
          aria-invalid={!!error}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`
            block w-full px-3 py-2 border rounded-md shadow-sm
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            transition-colors duration-200 appearance-none
            ${error 
              ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300'
            }
            ${disabled 
              ? 'bg-gray-50 text-gray-500 cursor-not-allowed' 
              : 'bg-white'
            }
            ${settings.highContrast ? 'border-2' : ''}
            ${settings.largeText ? 'text-lg py-3' : ''}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(({ value, label, disabled: optionDisabled }) => (
            <option
              key={value}
              value={value}
              disabled={optionDisabled}
            >
              {label}
            </option>
          ))}
        </select>
        
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-1 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {helperText && !error && (
        <div
          id={helperId}
          className="flex items-center space-x-1 text-sm text-gray-600"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </div>
  );
});

AccessibleSelect.displayName = 'AccessibleSelect';

// Accessible Checkbox Component
export const AccessibleCheckbox = forwardRef<HTMLInputElement, AccessibleCheckboxProps>(({
  id,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  indeterminate = false,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  const errorId = `${checkboxId}-error`;
  const helperId = `${checkboxId}-helper`;
  
  const { settings } = useAccessibility();

  const describedByIds = [
    ariaDescribedBy,
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate, ref]);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex items-center h-5">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            disabled={disabled}
            required={required}
            aria-describedby={describedByIds || undefined}
            aria-invalid={!!error}
            className={`
              w-4 h-4 text-indigo-600 border-gray-300 rounded
              focus:ring-2 focus:ring-indigo-500
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${settings.highContrast ? 'border-2' : ''}
              ${settings.largeText ? 'w-5 h-5' : ''}
            `}
            {...props}
          />
        </div>
        
        <div className="flex-1">
          <label
            htmlFor={checkboxId}
            className={`block text-sm font-medium cursor-pointer ${
              error ? 'text-red-700' : 'text-gray-700'
            } ${settings.highContrast ? 'font-bold' : ''}
            ${disabled ? 'cursor-not-allowed text-gray-500' : ''}`}
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-label="required">*</span>
            )}
          </label>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                id={errorId}
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center space-x-1 text-sm text-red-600 mt-1"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Helper Text */}
          {helperText && !error && (
            <div
              id={helperId}
              className="flex items-center space-x-1 text-sm text-gray-600 mt-1"
            >
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>{helperText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

AccessibleCheckbox.displayName = 'AccessibleCheckbox';

// Accessible Radio Group Component
export function AccessibleRadioGroup({
  id,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  name,
  options,
  value,
  onChange,
  orientation = 'vertical',
  className = '',
  'aria-describedby': ariaDescribedBy
}: AccessibleRadioGroupProps) {
  const generatedId = useId();
  const groupId = id || generatedId;
  const errorId = `${groupId}-error`;
  const helperId = `${groupId}-helper`;
  
  const { settings } = useAccessibility();

  const describedByIds = [
    ariaDescribedBy,
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ');

  return (
    <fieldset className={`space-y-2 ${className}`}>
      <legend
        className={`block text-sm font-medium ${
          error ? 'text-red-700' : 'text-gray-700'
        } ${settings.highContrast ? 'font-bold' : ''}`}
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </legend>

      <div
        role="radiogroup"
        aria-describedby={describedByIds || undefined}
        aria-invalid={!!error}
        aria-required={required}
        className={`space-y-2 ${
          orientation === 'horizontal' ? 'flex flex-wrap gap-4' : ''
        }`}
      >
        {options.map(({ value: optionValue, label: optionLabel, disabled: optionDisabled, description }) => {
          const radioId = `${groupId}-${optionValue}`;
          const descId = description ? `${radioId}-desc` : undefined;
          
          return (
            <div key={optionValue} className="flex items-start space-x-3">
              <div className="flex items-center h-5">
                <input
                  id={radioId}
                  name={name}
                  type="radio"
                  value={optionValue}
                  checked={value === optionValue}
                  disabled={disabled || optionDisabled}
                  aria-describedby={descId}
                  onChange={() => onChange?.(optionValue)}
                  className={`
                    w-4 h-4 text-indigo-600 border-gray-300
                    focus:ring-2 focus:ring-indigo-500
                    ${disabled || optionDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${settings.highContrast ? 'border-2' : ''}
                    ${settings.largeText ? 'w-5 h-5' : ''}
                  `}
                />
              </div>
              
              <div className="flex-1">
                <label
                  htmlFor={radioId}
                  className={`block text-sm font-medium cursor-pointer ${
                    disabled || optionDisabled ? 'cursor-not-allowed text-gray-500' : 'text-gray-700'
                  }`}
                >
                  {optionLabel}
                </label>
                
                {description && (
                  <p
                    id={descId}
                    className="text-sm text-gray-500 mt-1"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            id={errorId}
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center space-x-1 text-sm text-red-600"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      {helperText && !error && (
        <div
          id={helperId}
          className="flex items-center space-x-1 text-sm text-gray-600"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </fieldset>
  );
}