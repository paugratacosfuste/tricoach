import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, BarChart3, History, Target, User } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/progress', icon: BarChart3, label: 'Progress' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <ul className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={`
                  flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all
                  ${isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'}
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
