import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, BarChart3, Target, User } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/progress', icon: BarChart3, label: 'Progress' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border z-50 h-14">
      <ul className="flex items-center justify-around h-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all min-w-[44px] min-h-[44px] justify-center
                  ${isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-sm' : ''}`} />
                <span className="text-[10px] font-display font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
