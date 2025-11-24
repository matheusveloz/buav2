'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl px-4 sm:px-6 py-3 shadow-lg shadow-green-500/5">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="BUUA Logo" 
                className="h-9 w-auto"
              />
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-green-600 transition-colors font-medium">Recursos</a>
              <a href="#pricing" className="text-gray-600 hover:text-green-600 transition-colors font-medium">Preços</a>
              <a href="#" className="text-gray-600 hover:text-green-600 transition-colors font-medium">Contato</a>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <button className="text-gray-600 hover:text-green-600 transition-colors font-medium">
                Login
              </button>
              <button className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2.5 rounded-full font-medium hover:shadow-xl hover:shadow-green-500/30 hover:scale-105 transition-all">
                Começar Grátis
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden mt-4 pt-4 border-t border-gray-200/50"
              >
                <nav className="flex flex-col gap-4">
                  <a href="#features" className="text-gray-600 hover:text-green-600 transition-colors font-medium py-2">Recursos</a>
                  <a href="#pricing" className="text-gray-600 hover:text-green-600 transition-colors font-medium py-2">Preços</a>
                  <a href="#" className="text-gray-600 hover:text-green-600 transition-colors font-medium py-2">Contato</a>
                  <hr className="border-gray-200/50" />
                  <button className="text-gray-600 hover:text-green-600 transition-colors font-medium py-2 text-left">Login</button>
                  <button className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-full font-medium w-full">
                    Começar Grátis
                  </button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

