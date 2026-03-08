import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Upload, Settings, Home, Menu, X, Calendar } from 'lucide-react';
import { useState } from 'react';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut, isAdmin, isChefe, canUpload } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home, show: true },
    { to: '/upload', label: 'Upload', icon: Upload, show: canUpload },
    { to: '/events', label: 'Eventos', icon: Calendar, show: canUpload || isChefe },
    { to: '/admin', label: 'Admin', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">⚜️</span>
            <span className="font-display text-xl font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
              ScoutFoto
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.filter(i => i.show).map(item => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:block">
              {profile?.name}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t bg-background p-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.filter(i => i.show).map(item => (
                <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
