import { Calendar, Home, Utensils, Settings } from 'lucide-react'
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
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs transition',
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
        <div className="flex gap-2 rounded-3xl border border-white/10 bg-white/5 p-2">
          <Item to="/" label="Home" icon={Home} />
          <Item to="/calendar" label="Calendar" icon={Calendar} />
          <Item to="/nutrition" label="Nutrition" icon={Utensils} />
          <Item to="/settings" label="Settings" icon={Settings} />
        </div>
      </div>
    </div>
  )
}

