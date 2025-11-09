export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-center text-white">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Estamos construindo a{' '}
        <span className="relative inline-block">
          <span className="relative z-10 animate-shimmer bg-gradient-to-r from-white via-white to-white bg-[length:200%_100%] bg-clip-text text-transparent">
            BUUA v2
          </span>
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">
        Em breve uma nova experiência estará disponível. Obrigado por
        acompanhar este novo capítulo.
      </p>
      <div className="mt-10">
        <a
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-lg transition-all hover:shadow-xl hover:scale-105"
        >
          Começar agora
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    </main>
  );
}