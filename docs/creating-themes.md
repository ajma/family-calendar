# Adding a New Theme

The Family Calendar application supports a flexible, CSS Variable-driven theming architecture. To create a new theme, you only need to define a new set of CSS variables and add a selection card to the Settings interface.

## 1. Define the CSS Variables

All aesthetic properties (colors, borders, radii, shadows, and glassmorphism effects) are controlled by root CSS variables. Every theme must have its own dedicated directory inside `web/styles/themes/` containing a `style.css` mapping those variables, and a `thumbnail.jpg` preview image.

To create a new theme, create a new directory (e.g., `web/styles/themes/dark/`) and place a `style.css` file inside it defining a `:root` block using your theme name as the `data-theme` selector (e.g., `data-theme="dark"`).

Example content for `web/styles/themes/dark/style.css`:

```css
/* Example: Dark Mode Theme */
:root[data-theme="dark"] {
  /* Core Backgrounds */
  --bg-color: #0d1117;
  --surface-color-light: rgba(30, 30, 30, 0.7);
  --surface-color: #161b22;
  --surface-hover: rgba(50, 50, 50, 0.8);
  --border-color: rgba(255, 255, 255, 0.1);
  
  /* Typography */
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  
  /* Accent Colors */
  --accent-blue: #58a6ff;
  --accent-purple: #bc8cff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;

  /* Gradients */
  --header-gradient: linear-gradient(180deg, rgba(22, 27, 34, 0.9) 0%, rgba(22, 27, 34, 0) 100%);
  --card-gradient: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%);

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 15px rgba(88, 166, 255, 0.15);

  /* Dimensional Overrides (Optional) */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-round: 50%;
  
  /* Border & Interactive Overrides (Optional) */
  --border-thin: 1px solid var(--border-color);
  --border-thick: 2px solid var(--border-color);
  --event-hover-border: rgba(255, 255, 255, 0.15);
  --day-hover-border: rgba(255, 255, 255, 0.1);
  --day-header-bg: rgba(255, 255, 255, 0.03);
  --btn-primary-hover: #1f6feb;

  /* Glassmorphism Controls (Optional) */
  --glass-bg: rgba(22, 27, 34, 0.7);
  --glass-blur: blur(12px);
  --glass-border: 1px solid var(--border-color);
}
```

After creating the file, open `web/index.css` and import it at the top so Vite includes it in the bundle:

```css
@import url('./styles/themes/light/style.css');
@import url('./styles/themes/dark/style.css'); /* Add your new theme here */
```

*Note: You do not need to redefine structural variables (like `--radius-*` or `--transition-*`) unless your theme specifically requires different sizes or timings than the default theme, but it is standard practice to encapsulate all definitions in the file so the theme is portable.*

## 2. Generate a Thumbnail

Provide a small `thumbnail.jpg` graphic in the same directory (e.g., `web/styles/themes/dark/thumbnail.jpg`). This will be displayed to the user inside the Settings Modal as a visual preview.

## 3. Add the Theme to the Settings UI

Once the CSS variables and thumbnail are ready, you need to provide a way for users to select the theme.

Open `web/components/SettingsModal.tsx` and import the thumbnail at the top:

```tsx
import darkThumb from '../styles/themes/dark/thumbnail.jpg';
```

Then locate the `activeTab === 'appearance'` section and add a new clickable card inside the grid alongside the existing preview items:

```tsx
{/* Dark Theme Card Example */}
<div 
  onClick={() => setAppearance({ ...appearance, theme: 'dark' })}
  style={{
    border: appearance?.theme === 'dark' ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem',
    cursor: 'pointer',
    background: 'var(--surface-color)',
    boxShadow: appearance?.theme === 'dark' ? '0 0 0 4px rgba(9, 105, 218, 0.2)' : 'var(--shadow-sm)',
    transition: 'all 0.2s ease'
  }}
>
  <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Dark Mode</div>
  <img 
    src={darkThumb} 
    alt="Dark Mode Preview" 
    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} 
  />
</div>
```

That's it! The `CalendarContext` automatically handles the rest—saving the preference to the SQLite backend and local storage, and instantly injecting the `data-theme="dark"` attribute to the `<html>` root to trigger your new CSS properties!
