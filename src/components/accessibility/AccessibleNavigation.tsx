'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Search, 
  Home, 
  User, 
  Settings, 
  Bell, 
  MessageCircle, 
  Heart,
  Bookmark,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Keyboard
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { 
  useScreenReader, 
  useFocusManagement, 
  useKeyboardNavigation, 
  useSkipLinks, 
  useAriaUtilities 
} from '@/hooks/useAccessibilityHooks';

interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<any>;
  children?: NavigationItem[];
  badge?: string | number;
  disabled?: boolean;
  description?: string;
}

interface AccessibleNavigationProps {
  items: NavigationItem[];
  currentPath?: string;
  logo?: React.ReactNode;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// Main Accessible Navigation Component
export function AccessibleNavigation({
  items,
  currentPath,
  logo,
  showSearch = true,
  onSearch,
  className = ''
}: AccessibleNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const router = useRouter();
  const { settings } = useAccessibility();
  const { announce, announceNavigation } = useScreenReader();
  const { focusElement, createFocusTrap } = useFocusManagement();
  const { addShortcut, removeShortcut, getShortcutHelp } = useKeyboardNavigation();
  const { SkipLinksComponent } = useSkipLinks();

  const navigationRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    addShortcut('alt+m', () => setIsMobileMenuOpen(!isMobileMenuOpen), 'Toggle mobile menu');
    addShortcut('alt+slash', () => searchInputRef.current?.focus(), 'Focus search');
    addShortcut('alt+h', () => setShowShortcutsHelp(true), 'Show keyboard shortcuts help');
    addShortcut('escape', () => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      } else if (showShortcutsHelp) {
        setShowShortcutsHelp(false);
      }
    }, 'Close menu or modal');

    return () => {
      removeShortcut('alt+m');
      removeShortcut('alt+slash');
      removeShortcut('alt+h');
      removeShortcut('escape');
    };
  }, [isMobileMenuOpen, showShortcutsHelp]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (isMobileMenuOpen && mobileMenuRef.current) {
      const cleanup = createFocusTrap(mobileMenuRef);
      return cleanup;
    }
  }, [isMobileMenuOpen, createFocusTrap]);

  const handleItemClick = useCallback((item: NavigationItem) => {
    if (item.disabled) {
      announce('This menu item is disabled', 'assertive');
      return;
    }

    if (item.href) {
      announceNavigation(item.label);
      router.push(item.href);
    } else if (item.onClick) {
      item.onClick();
    }

    setIsMobileMenuOpen(false);
  }, [announce, announceNavigation, router]);

  const handleItemExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        announce('Menu collapsed');
      } else {
        newSet.add(itemId);
        announce('Menu expanded');
      }
      return newSet;
    });
  }, [announce]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      announce(`Searching for ${searchQuery.trim()}`);
    }
  }, [searchQuery, onSearch, announce]);

  const renderNavigationItem = (item: NavigationItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isCurrent = currentPath === item.href;
    const Icon = item.icon;

    return (
      <li key={item.id} role="none">
        <div
          className={`flex items-center ${depth > 0 ? 'ml-4' : ''}`}
          role={hasChildren ? 'button' : 'none'}
        >
          {hasChildren ? (
            <button
              onClick={() => handleItemExpand(item.id)}
              className={`flex items-center justify-between w-full px-3 py-2 text-left rounded-md transition-colors ${
                isCurrent 
                  ? 'bg-indigo-100 text-indigo-700 font-medium' 
                  : 'text-gray-700 hover:bg-gray-100'
              } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-expanded={isExpanded}
              aria-describedby={item.description ? `${item.id}-desc` : undefined}
              disabled={item.disabled}
            >
              <div className="flex items-center space-x-3">
                {Icon && <Icon className="w-5 h-5" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    {item.badge}
                  </span>
                )}
              </div>
              <ChevronRight 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <a
              href={item.href}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  handleItemClick(item);
                }
              }}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors ${
                isCurrent 
                  ? 'bg-indigo-100 text-indigo-700 font-medium' 
                  : 'text-gray-700 hover:bg-gray-100'
              } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
              aria-describedby={item.description ? `${item.id}-desc` : undefined}
            >
              <div className="flex items-center space-x-3">
                {Icon && <Icon className="w-5 h-5" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    {item.badge}
                  </span>
                )}
              </div>
            </a>
          )}
        </div>

        {item.description && (
          <p id={`${item.id}-desc`} className="sr-only">
            {item.description}
          </p>
        )}

        {hasChildren && isExpanded && (
          <ul role="group" className="mt-1 space-y-1">
            {item.children?.map(child => renderNavigationItem(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <SkipLinksComponent />
      
      <nav
        ref={navigationRef}
        role="navigation"
        aria-label="Main navigation"
        className={`bg-white border-b border-gray-200 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {logo || (
                  <span className="text-xl font-bold text-indigo-600">
                    DirectFanZ
                  </span>
                )}
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <ul role="menubar" className="flex items-center space-x-4">
                {items.map(item => (
                  <li key={item.id} role="none">
                    {item.children ? (
                      <div className="relative group">
                        <button
                          role="menuitem"
                          aria-haspopup="true"
                          aria-expanded="false"
                          className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            currentPath === item.href
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={item.disabled}
                        >
                          {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                          {item.label}
                          <ChevronDown className="w-4 h-4 ml-1" />
                        </button>

                        {/* Dropdown Menu */}
                        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                          <ul role="menu" className="py-1">
                            {item.children.map(child => (
                              <li key={child.id} role="none">
                                <a
                                  role="menuitem"
                                  href={child.href}
                                  onClick={(e) => {
                                    if (child.onClick) {
                                      e.preventDefault();
                                      handleItemClick(child);
                                    }
                                  }}
                                  className={`block px-4 py-2 text-sm transition-colors ${
                                    currentPath === child.href
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'text-gray-700 hover:bg-gray-100'
                                  } ${child.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  aria-current={currentPath === child.href ? 'page' : undefined}
                                >
                                  {child.icon && <child.icon className="w-4 h-4 inline mr-2" />}
                                  {child.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <a
                        role="menuitem"
                        href={item.href}
                        onClick={(e) => {
                          if (item.onClick) {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentPath === item.href
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-current={currentPath === item.href ? 'page' : undefined}
                      >
                        {item.icon && <item.icon className="w-4 h-4 mr-2" />}
                        {item.label}
                        {item.badge && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              {showSearch && (
                <form onSubmit={handleSearch} role="search">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className={`w-64 px-3 py-1.5 pl-10 pr-4 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        settings.highContrast ? 'border-2' : ''
                      }`}
                      aria-label="Search DirectFanZ"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </form>
              )}

              {/* Keyboard Shortcuts Help */}
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (Alt+H)"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              ref={mobileMenuRef}
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-gray-200"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                <ul role="menu" className="space-y-1">
                  {items.map(item => renderNavigationItem(item))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}

// Breadcrumbs Component
export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const { announceNavigation } = useScreenReader();
  
  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    if (!item.current) {
      announceNavigation(item.label);
    }
  };

  return (
    <nav aria-label="Breadcrumb" className={`py-4 ${className}`}>
      <ol className="flex items-center space-x-1 text-sm text-gray-500">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            )}
            
            {item.current ? (
              <span 
                className="text-gray-900 font-medium"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                onClick={() => handleBreadcrumbClick(item)}
                className="hover:text-gray-700 transition-colors"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Back to Top Button
export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const { announce } = useScreenReader();

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    announce('Scrolled to top of page');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors z-50"
          aria-label="Back to top"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// Keyboard Shortcuts Help Modal
function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { getShortcutHelp } = useKeyboardNavigation();
  const shortcuts = getShortcutHelp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close shortcuts help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-80">
          <div className="grid gap-4 md:grid-cols-2">
            {shortcuts.map(({ key, description }) => (
              <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">{description}</span>
                <kbd className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-mono rounded">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}