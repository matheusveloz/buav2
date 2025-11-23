'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Video, Mic, ImageIcon } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: '/home',
      label: 'Home',
      Icon: Home,
    },
    {
      href: '/avatar-video',
      label: 'Vídeo Avatar',
      Icon: Video,
    },
    {
      href: '/create-voice',
      label: 'Criar Voz',
      Icon: Mic,
    },
    {
      href: '/image-generator',
      label: 'Gerar Imagem',
      Icon: ImageIcon,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-b border-gray-200/50 p-6">
        <Link href="/home" className="flex items-center gap-3 transition hover:opacity-80">
          <Image src="/ico.png" alt="BUUA Logo" width={40} height={40} className="rounded-lg" />
          <span className="text-xl font-bold">
            <span className="text-gray-900">Buua</span>
            <span className="text-green-500">.</span>
          </span>
        </Link>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.Icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-[#c7f9e0]'
                  : 'hover:bg-gray-100'
              }`}
            >
              {/* Ícone sem background, com animação */}
              <Icon 
                className={`w-5 h-5 transition-all duration-200 ${
                  isActive 
                    ? 'text-[#4b5563]' 
                    : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-6'
                }`}
                strokeWidth={2}
              />
              <span className={`text-sm font-medium text-[#4b5563] ${
                isActive ? 'font-semibold' : ''
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

