/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                unbounded: ['Unbounded', 'sans-serif'],
                display: ['Sora', 'Unbounded', 'sans-serif'],
                sans: ['Plus Jakarta Sans', 'Manrope', 'system-ui', 'sans-serif'],
                manrope: ['Manrope', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                // Premium Gold Colors
                gold: {
                    DEFAULT: '#D4AF37',
                    light: '#F4D03F',
                    dark: '#B8860B',
                    50: '#FDF8E7',
                    100: '#FAF0CF',
                    200: '#F5E19F',
                    300: '#F0D26F',
                    400: '#EBC33F',
                    500: '#D4AF37',
                    600: '#B8960F',
                    700: '#8B720B',
                    800: '#5E4D08',
                    900: '#312804',
                },
                // Category colors
                cinema: '#FF0055',
                football: '#D4AF37',
                ferry: '#00F0FF',
                train: '#FFD600',
                concerts: '#7000FF',
                conferences: '#FF5C00',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' }
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' }
                },
                'fade-in': {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' }
                },
                'slide-up': {
                    from: { transform: 'translateY(100%)' },
                    to: { transform: 'translateY(0)' }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in': 'fade-in 0.5s ease-out',
                'slide-up': 'slide-up 0.3s ease-out'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};
