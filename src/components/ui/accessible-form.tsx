'use client';

import React, { useState, useEffect } from 'react';
import { ErrorMessage, FormLabel } from './accessibility';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  description?: string;
  className?: string;
}

/**
 * AccessibleFormField component that wraps form inputs with proper accessibility attributes
 */
export function AccessibleFormField({
  id,
  label,
  required = false,
  error,
  children,
  description,
  className = '',
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  
  // Clone the child element to add accessibility attributes
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        id,
        'aria-invalid': error ? 'true' : 'false',
        'aria-required': required,
        'aria-describedby': `${description ? descriptionId : ''} ${error ? errorId : ''}`.trim() || undefined,
      });
    }
    return child;
  });

  return (
    <div className={`mb-4 ${className}`}>
      <FormLabel htmlFor={id} required={required}>
        {label}
      </FormLabel>
      
      {description && (
        <p id={descriptionId} className="text-sm text-gray-500 mt-1 mb-2">
          {description}
        </p>
      )}
      
      {childrenWithProps}
      
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}

interface AccessibleFormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

/**
 * AccessibleForm component that provides form validation and accessibility features
 */
export function AccessibleForm({
  onSubmit,
  children,
  className = '',
  ariaLabel,
  ariaDescribedBy,
}: AccessibleFormProps) {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  
  // Check for form validation errors
  useEffect(() => {
    if (formSubmitted && formRef.current) {
      const invalidFields = formRef.current.querySelectorAll('[aria-invalid="true"]');
      setHasErrors(invalidFields.length > 0);
      
      // Focus the first invalid field
      if (invalidFields.length > 0) {
        (invalidFields[0] as HTMLElement).focus();
      }
    }
  }, [formSubmitted]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    onSubmit(e);
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={className}
      noValidate
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {children}
      
      {/* Accessibility announcement for form errors */}
      {formSubmitted && hasErrors && (
        <div className="sr-only" aria-live="assertive">
          The form contains errors. Please correct them and try again.
        </div>
      )}
    </form>
  );
}

/**
 * AccessibleErrorSummary component that displays a summary of form errors
 */
export function AccessibleErrorSummary({
  errors,
  className = '',
}: {
  errors: Record<string, string>;
  className?: string;
}) {
  const errorKeys = Object.keys(errors).filter(key => errors[key]);
  
  if (errorKeys.length === 0) {
    return null;
  }
  
  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-md p-4 mb-6 ${className}`}
      role="alert"
      aria-labelledby="error-summary-title"
    >
      <h2 id="error-summary-title" className="text-red-700 font-medium text-sm">
        Please correct the following errors:
      </h2>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        {errorKeys.map(key => (
          <li key={key} className="text-red-600 text-sm">
            <a href={`#${key}`} className="underline focus:outline-none focus:ring-2 focus:ring-red-500">
              {errors[key]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * useAccessibleForm hook for managing form state with accessibility features
 */
export function useAccessibleForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    
    // Clear error when field is changed
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    
    setTouched(prev => ({
      ...prev,
      [name]: true,
    }));
  };
  
  const setFieldValue = (name: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const setFieldError = (name: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [name]: error,
    }));
  };
  
  const validateForm = (validationSchema: any) => {
    try {
      validationSchema.parse(values);
      setErrors({});
      return true;
    } catch (error: any) {
      const newErrors: Record<string, string> = {};
      
      if (error.errors) {
        error.errors.forEach((err: any) => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
      }
      
      setErrors(newErrors);
      return false;
    }
  };
  
  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    validateForm,
  };
}