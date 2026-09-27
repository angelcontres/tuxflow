import React from 'react';
import { Share2, Bell, MessageSquare, Compass } from 'lucide-react';

interface NavbarProps {
  currentUsername: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUsername }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white font-black text-xl">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Red Distribuida
            </span>
            <div className="flex items-center gap-1.5 -mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                Neo4j • Quarkus • MinIO
              </span>
            </div>
          </div>
        </div>

        {/* Action icons & User profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Compass className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-sky-500 rounded-full" />
          </button>
          <button className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <MessageSquare className="w-5 h-5" />
          </button>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

          {/* User Badge */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
              {currentUsername.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-900">@{currentUsername}</p>
              <p className="text-[10px] text-emerald-600 font-medium">En línea</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
