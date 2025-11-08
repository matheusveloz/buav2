export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-center text-white">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Estamos construindo a BUUA v2
      </h1>
      <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">
        Em breve uma nova experiência estará disponível. Obrigado por
        acompanhar este novo capítulo.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <a
          href="/login"
          className="rounded-full border border-white px-6 py-3 text-base font-semibold transition hover:bg-white hover:text-black"
        >
          Entrar
        </a>
        <a
          href="/signup"
          className="rounded-full bg-white px-6 py-3 text-base font-semibold text-black transition hover:bg-white/90"
        >
          Criar conta
        </a>
      </div>
    </main>
  );
}
