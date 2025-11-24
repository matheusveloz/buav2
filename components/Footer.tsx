export default function Footer() {
  return (
    <footer className="py-12 sm:py-16 px-4 border-t border-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8 sm:mb-12">
          {/* Logo */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/logo.png" 
                alt="BUUA Logo" 
                className="h-9 w-auto"
              />
            </div>
            <p className="text-gray-500 text-sm">
              Criando o futuro dos vídeos com IA
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Produto</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="#" className="hover:text-green-600 transition-colors">Recursos</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Preços</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Exemplos</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Empresa</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="#" className="hover:text-green-600 transition-colors">Sobre</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Carreiras</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Suporte</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="#" className="hover:text-green-600 transition-colors">Ajuda</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Contato</a></li>
              <li><a href="#" className="hover:text-green-600 transition-colors">Termos</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          © 2025 BUUA. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}

