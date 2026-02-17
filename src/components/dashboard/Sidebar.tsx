import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, BarChart3, History, Target, Settings, User, Activity } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/progress', icon: BarChart3, label: 'Progress' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-hero-gradient rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">TriCoach AI</h1>
            <p className="text-xs text-muted-foreground">Training Planner</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4">
          <p className="text-sm font-medium mb-1">Need help?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Get tips on improving your training plan.
          </p>
          <button className="text-xs text-primary font-medium hover:underline">
            View coaching tips →
          </button>
        </div>
      </div>
    </aside>
  );
}
