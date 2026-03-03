# 🏆 BEST PRACTICES & FUTURE DEVELOPMENT GUIDE

## 1. RESPONSIVE DESIGN PATTERNS

### ✅ DO: Progressive Text Sizing
```jsx
// Good - Gradual progression
<h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
  Title
</h1>

// Bad - Too many jumps
<h1 className="text-sm md:text-4xl">Title</h1>
```

### ✅ DO: Padding/Gap Scaling
```jsx
// Good - Consistent progression
<div className="px-2 sm:px-4 md:px-6 lg:px-8">
  <div className="space-y-2 sm:space-y-4 md:space-y-6">
    {/* Content */}
  </div>
</div>

// Bad - No progression
<div className="px-4 md:px-10">
  <div className="space-y-4">
    {/* Content */}
  </div>
</div>
```

### ✅ DO: Responsive Grids
```jsx
// Good - Optimized for each breakpoint
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
  {/* Cards */}
</div>

// Breakpoint explanation:
// • sm (640px): Mobile landscape, small tablets
// • md (768px): Tablet portrait (transition)
// • lg (1024px): Large tablets, desktop (optimal)
```

### ❌ DON'T: Hardcoded Heights
```jsx
// Bad - Breaks in landscape and different devices
<div className="h-[calc(100dvh-64px)]">Content</div>

// Good - Flexible height
<div className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-1 overflow-y-auto">Content</div>
</div>
```

---

## 2. PERFORMANCE OPTIMIZATION

### ✅ DO: Extract Constants
```jsx
// Good - Constant extracted outside component
const MENU_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', iconName: 'LayoutDashboard' },
  // ...
];

const renderIcon = (iconName) => {
  const iconMap = { /* ... */ };
  return iconMap[iconName];
};

function Component() {
  return MENU_ITEMS.map(item => (
    <button key={item.id}>
      {renderIcon(item.iconName)}
    </button>
  ));
}

// Bad - Recreated every render
function Component() {
  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard /> },
  ];
  return menuItems.map(item => (
    <button key={item.id}>{item.icon}</button>
  ));
}
```

### ✅ DO: Memoize Callbacks
```jsx
// Good
const toggleMenu = useCallback(() => {
  setIsMobileMenuOpen(prev => !prev);
}, []);

// Bad - New function every render
const toggleMenu = () => {
  setIsMobileMenuOpen(!isMobileMenuOpen);
};
```

### ✅ DO: Data Validation Helper
```jsx
// Good - Reusable normalization
const normalizeValue = (obj, fieldNames, defaultValue = 0) => {
  if (!obj) return defaultValue;
  for (const field of fieldNames) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    }
  }
  return defaultValue;
};

// Usage across app
const qty = normalizeValue(item, ['qty', 'quantity', 'jumlah'], 1);
const price = normalizeValue(item, ['price', 'harga', 'harga_jual'], 0);
```

---

## 3. ACCESSIBILITY PATTERNS

### ✅ DO: Use ARIA Attributes
```jsx
// Good - Proper ARIA
<button
  aria-expanded={isOpen}
  aria-label={isOpen ? "Close menu" : "Open menu"}
  aria-current={isActive ? "page" : undefined}
  className="focus:ring-2 focus:ring-blue-500"
>
  {label}
</button>

// Bad - Missing ARIA
<button onClick={toggle}>
  {label}
</button>
```

### ✅ DO: Keyboard Navigation
```jsx
// Good - Escape support
useEffect(() => {
  const handleKey = (e) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };
  if (isOpen) {
    window.addEventListener('keydown', handleKey);
  }
  return () => window.removeEventListener('keydown', handleKey);
}, [isOpen]);

// Bad - No keyboard support
// (only mouse click)
```

### ✅ DO: Focus Indicators
```jsx
// Good - Visible focus ring
<button className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
  Action
</button>

// Bad - No focus indication
<button className="focus:outline-none">
  Action
</button>
```

---

## 4. ERROR HANDLING PATTERNS

### ✅ DO: Comprehensive Error Handling
```jsx
// Good - All cases covered
const [error, setError] = useState(null);

const fetchData = async () => {
  setError(null);
  try {
    const { data, error: dbError } = await supabase.from('table').select('*');
    
    if (dbError) {
      // Distinguish error types
      if (dbError.code === 'PGRST116') {
        // No rows, not an error
        return;
      }
      throw new Error(`Database: ${dbError.message}`);
    }
    
    // Validate data
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format');
    }
    
    setData(data);
  } catch (err) {
    setError(err.message);
  }
};

// In JSX:
{error && (
  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
    <p className="text-rose-900">{error}</p>
    <button onClick={fetchData} className="text-rose-700 underline">
      Retry
    </button>
  </div>
)}
```

### ❌ DON'T: Silent Failures
```jsx
// Bad - Error disappears
try {
  // something
} catch (err) {
  console.error(err);  // Only visible in console!
  // Continue as if nothing happened
}
```

---

## 5. DATE/TIME HANDLING

### ✅ DO: Timezone-Aware Calculations
```jsx
// Good - Proper timezone handling
const getMonthDateRange = (yearMonth) => {
  const [year, month] = yearMonth.split('-').map(Number);
  
  // Create local dates (not UTC)
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Convert with timezone awareness
  const startISO = startDate.toISOString();
  const endISO = new Date(
    endDate.getTime() + endDate.getTimezoneOffset() * 60000
  ).toISOString();
  
  return { startISO, endISO };
};

// Usage
const { startISO, endISO } = getMonthDateRange('2026-03');
const { data } = await supabase
  .from('transactions')
  .select('*')
  .gte('created_at', startISO)
  .lte('created_at', endISO);
```

### ❌ DON'T: UTC-only Assumptions
```jsx
// Bad - Timezone mismatch
const startDate = `${yearMonth}-01T00:00:00.000Z`;  // UTC!
// If user in Indonesia (UTC+7), this loses 7 hours of data daily!
```

---

## 6. COMPONENT PATTERNS

### ✅ DO: Prop Validation
```jsx
// Good - PropTypes or TypeScript
function CardComponent({ 
  title = 'Default', 
  value = 0, 
  variant = 'default' 
}) {
  if (typeof value !== 'number') {
    console.warn('CardComponent: value must be number');
    return null;
  }
  
  return <div>{title}: {value}</div>;
}

// Or TypeScript:
interface CardProps {
  title?: string;
  value: number;
  variant?: 'default' | 'success' | 'error';
}

function Card({ title = 'Default', value, variant = 'default' }: CardProps) {
  // No need for manual validation
  return <div>{title}: {value}</div>;
}
```

### ✅ DO: Composition Over Inheritance
```jsx
// Good - Composable components
function LoadingState() {
  return <div className="p-8 text-center"><Spinner /></div>;
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="p-4 bg-rose-50">
      <p>{error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

function ContentView({ data }) {
  return <div>{data}</div>;
}

function DataDisplay({ isLoading, error, data, onRetry }) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return <ContentView data={data} />;
}
```

---

## 7. TESTING CHECKLIST

### Layout Testing
- [ ] Test on actual devices (not just browser DevTools)
- [ ] Test orientation change (portrait → landscape)
- [ ] Test with different text sizes (OS accessibility settings)
- [ ] Test with zoom active (+100%, +150%)
- [ ] Test with virtual keyboard (mobile)

### Accessibility Testing
- [ ] Tab through all interactive elements
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Check color contrast (WCAG AA minimum 4.5:1)
- [ ] Ensure all buttons 44px minimum touch target
- [ ] Test focus indicators visible

### Data Testing
- [ ] Test with empty data (no results)
- [ ] Test with null/undefined values
- [ ] Test with very long text (100+ chars)
- [ ] Test with large numbers (1,000,000+)
- [ ] Test with date boundaries (month start/end)

### Performance Testing
- [ ] Test on slow network (3G throttle)
- [ ] Test on low-end device (Android 6 or older)
- [ ] Check for unnecessary re-renders
- [ ] Monitor bundle size

---

## 8. FILE ORGANIZATION

### ✅ DO: Logical Structure
```
src/
├── components/
│   └── Dashboard/
│       ├── KamarManager/
│       │   ├── KamarManagerLayout.jsx      ← Main container
│       │   ├── SayapFinance.jsx            ← Feature container
│       │   └── SayapFinance/
│       │       ├── TabDashboardKeuangan.jsx
│       │       ├── TabPettyCash.jsx
│       │       └── ... (related files)
│       └── ... (other features)
├── utils/
│   ├── normalization.js                    ← Helper functions
│   ├── dateHelpers.js                      ← Date utilities
│   └── validation.js                       ← Validators
├── constants/
│   ├── menuItems.js                        ← Constants
│   └── colors.js
└── supabaseClient.js
```

### DO: Separate Concerns
```jsx
// Good - Utility functions exported
// utils/normalization.js
export const normalizeValue = (obj, fieldNames, defaultValue = 0) => {
  // ...
};

// Component uses utility
import { normalizeValue } from '../../utils/normalization';

// Bad - Everything in component
function Component() {
  const normalizeValue = (obj, fieldNames, defaultValue = 0) => {
    // Duplicated in every component!
  };
}
```

---

## 9. COMMON PITFALLS TO AVOID

### ❌ DONT: Recreate Objects/Functions in Render
```jsx
// Bad
function Component() {
  const config = { timeout: 5000 };  // New object every render!
  return <Child config={config} />;
}

// Good
const CONFIG = { timeout: 5000 };
function Component() {
  return <Child config={CONFIG} />;
}
```

### ❌ DONT: Use Index as Key
```jsx
// Bad - Causes bugs when list reorders
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

// Good - Unique identifier
{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}
```

### ❌ DONT: Ignore Loading States
```jsx
// Bad - Looks frozen to user
{isLoading && <Content />}

// Good - Give feedback
{isLoading ? <Spinner /> : <Content />}
```

### ❌ DONT: Mute Errors
```jsx
// Bad - User doesn't know what went wrong
try {
  await fetchData();
} catch (e) {
  console.error(e);
}

// Good - Tell user
try {
  await fetchData();
} catch (e) {
  setError(e.message);
}
```

---

## 10. DEPLOYMENT CHECKLIST

### Before Every Deploy
- [ ] Run lint check (`npm run lint` if available)
- [ ] Test all responsive breakpoints
- [ ] Test major user flows end-to-end
- [ ] Check for console errors/warnings
- [ ] Verify error messages are user-friendly
- [ ] Test slow network (3G throttle in DevTools)
- [ ] Check accessibility (keyboard nav + screen reader)

### During Deploy
- [ ] Have rollback plan ready
- [ ] Monitor error logs
- [ ] Have hotline ready for critical issues
- [ ] Document any data migrations

### After Deploy
- [ ] Monitor real user metrics
- [ ] Check error tracking dashboard
- [ ] Gather user feedback
- [ ] Plan improvements based on data

---

## 📚 REFERENCES & RESOURCES

### Design System
- Tailwind CSS: https://tailwindcss.com/docs
- Lucide Icons: https://lucide.dev
- Color contrast checker: https://webaim.org/resources/contrastchecker/

### Accessibility
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Web Accessibility Testing: https://www.w3.org/WAI/test-evaluate/

### Performance
- React DevTools Profiler: https://react.dev/learn/react-developer-tools
- Chrome DevTools Performance: https://developer.chrome.com/docs/devtools/performance/
- Web Vitals: https://web.dev/vitals/

### Date/Time
- MDN DateObject: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- Timezone Best Practices: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Numbers_and_dates

---

## 🎯 SUMMARY

**Key Takeaways:**
1. ✅ Always test responsive on multiple devices
2. ✅ Use utility functions for repeated logic
3. ✅ Show errors to users clearly
4. ✅ Handle keyboard navigation
5. ✅ Use proper ARIA attributes
6. ✅ Validate data before calculations
7. ✅ Be timezone-aware with dates
8. ✅ Extract constants outside components
9. ✅ Provide loading & error states
10. ✅ Keep accessibility in mind always

**Remember:** Good code is not just working code, it's code that:
- Works on all devices at all sizes
- Provides clear feedback to users
- Is accessible to everyone
- Handles errors gracefully
- Is maintainable for future developers

