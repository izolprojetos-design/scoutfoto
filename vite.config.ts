import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx'],
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: mode === 'production' ? {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'query': ['@tanstack/react-query'],
          'supabase': ['@supabase/supabase-js'],
          'icons': ['lucide-react'],
          'motion': ['framer-motion'],
          'charts': ['recharts'],
          'ui-vendor': ['sonner', 'date-fns', 'class-variance-authority', 'clsx', 'tailwind-merge'],
        } : undefined,
      },
    },
  },
  esbuild: {
    // Drop console/debugger in production for smaller, faster bundles on mobile
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@tanstack/react-query', 
      '@supabase/supabase-js', 
      'lucide-react', 
      'framer-motion', 
      'recharts',
      'date-fns',
      'sonner'
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
