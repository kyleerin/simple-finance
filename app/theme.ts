export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "simple-finance:theme";

/** Inline boot script: apply stored theme before paint to avoid a flash. */
export const themeBootScript = `(()=>{try{const t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
