(function () {
    const savedThemeKey = "glow-grace-theme";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

    const getSavedTheme = () => {
        try {
            return localStorage.getItem(savedThemeKey);
        } catch (error) {
            return null;
        }
    };

    const saveTheme = (theme) => {
        try {
            localStorage.setItem(savedThemeKey, theme);
        } catch (error) {
            return null;
        }
    };

    const getPreferredTheme = () => getSavedTheme() || (systemTheme.matches ? "dark" : "light");

    const setTheme = (theme) => {
        const isDark = theme === "dark";
        const themeToggle = document.querySelector("[data-theme-toggle]");
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');

        document.documentElement.dataset.theme = theme;

        if (themeToggle) {
            themeToggle.setAttribute("aria-pressed", String(isDark));
            themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
            themeToggle.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
        }

        if (themeColorMeta) {
            themeColorMeta.setAttribute("content", isDark ? "#0f1518" : "#f7f9fb");
        }
    };

    setTheme(getPreferredTheme());

    document.addEventListener("DOMContentLoaded", () => {
        const themeToggle = document.querySelector("[data-theme-toggle]");

        setTheme(getPreferredTheme());

        if (themeToggle) {
            themeToggle.addEventListener("click", () => {
                const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
                setTheme(nextTheme);
                saveTheme(nextTheme);
            });
        }

        systemTheme.addEventListener("change", (event) => {
            if (!getSavedTheme()) {
                setTheme(event.matches ? "dark" : "light");
            }
        });
    });
})();
