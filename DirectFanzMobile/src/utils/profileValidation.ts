import { ProfileEditData, ProfileValidationErrors } from '../types/profile';

// Regular expressions for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
const PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;
const SOCIAL_HANDLE_REGEX = /^@?[a-zA-Z0-9_.-]+$/;

export const validateProfileData = (data: ProfileEditData): ProfileValidationErrors | null => {
  const errors: ProfileValidationErrors = {};
  let hasErrors = false;

  // Name validation
  if (data.name !== undefined) {
    if (!data.name.trim()) {
      errors.name = 'Name is required';
      hasErrors = true;
    } else if (data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
      hasErrors = true;
    } else if (data.name.trim().length > 100) {
      errors.name = 'Name must be less than 100 characters';
      hasErrors = true;
    }
  }

  // Bio validation
  if (data.bio !== undefined && data.bio.length > 500) {
    errors.bio = 'Bio must be less than 500 characters';
    hasErrors = true;
  }

  // Website validation
  if (data.website !== undefined && data.website.trim()) {
    if (!URL_REGEX.test(data.website.trim())) {
      errors.website = 'Please enter a valid website URL';
      hasErrors = true;
    }
  }

  // Artist name validation
  if (data.artistName !== undefined) {
    if (data.artistName.trim() && data.artistName.trim().length < 2) {
      errors.artistName = 'Artist name must be at least 2 characters long';
      hasErrors = true;
    } else if (data.artistName.trim().length > 100) {
      errors.artistName = 'Artist name must be less than 100 characters';
      hasErrors = true;
    }
  }

  // Phone number validation
  if (data.phoneNumber !== undefined && data.phoneNumber.trim()) {
    if (!PHONE_REGEX.test(data.phoneNumber.trim())) {
      errors.phoneNumber = 'Please enter a valid phone number';
      hasErrors = true;
    }
  }

  // Social links validation
  if (data.socialLinks) {
    const socialErrors: Partial<Record<keyof typeof data.socialLinks, string>> = {};
    let hasSocialErrors = false;

    Object.entries(data.socialLinks).forEach(([platform, handle]) => {
      if (handle && handle.trim()) {
        switch (platform) {
          case 'instagram':
          case 'twitter':
          case 'tiktok':
            if (!SOCIAL_HANDLE_REGEX.test(handle.trim())) {
              socialErrors[platform as keyof typeof data.socialLinks] = `Invalid ${platform} handle`;
              hasSocialErrors = true;
            }
            break;
          case 'website':
          case 'spotify':
          case 'soundcloud':
          case 'youtube':
          case 'facebook':
            if (!URL_REGEX.test(handle.trim()) && !handle.trim().startsWith('http')) {
              // Allow partial URLs for some platforms
              const fullUrl = `https://${handle.trim()}`;
              if (!URL_REGEX.test(fullUrl)) {
                socialErrors[platform as keyof typeof data.socialLinks] = `Invalid ${platform} URL`;
                hasSocialErrors = true;
              }
            }
            break;
          default:
            break;
        }
      }
    });

    if (hasSocialErrors) {
      errors.socialLinks = socialErrors;
      hasErrors = true;
    }
  }

  return hasErrors ? errors : null;
};

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/(?=.*\d)/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
};

export const validatePasswordMatch = (password: string, confirmPassword: string): string | null => {
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
};

export const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const sanitizeSocialHandle = (handle: string): string => {
  if (!handle) return '';
  const trimmed = handle.trim();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // US phone number formatting
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }
  
  return cleaned;
};