import { BarChart3, Calendar, Dumbbell, Home, Trophy, Utensils, UserCircle } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'

function Item({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof Home
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition',
          isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  )
}

export function BottomNav() {
  return (
    <div className="safe-area-px safe-area-pb fixed bottom-0 left-0 right-0 z-20 bg-[#070b14]/80 backdrop-blur">
      <div className="mx-auto w-full max-w-md px-4 pb-3 pt-2">
        <div className="flex gap-1 rounded-3xl border border-white/10 bg-white/5 p-1.5">
          <Item to="/" label="Home" icon={Home} />
          <Item to="/plan" label="Plan" icon={Dumbbell} />
          <Item to="/calendar" label="Calendar" icon={Calendar} />
          <Item to="/history" label="Progress" icon={BarChart3} />
          <Item to="/races" label="Races" icon={Trophy} />
          <Item to="/nutrition" label="Nutrition" icon={Utensils} />
          <Item to="/settings" label="Account" icon={UserCircle} />
        </div>
      </div>
    </div>
  )
}
