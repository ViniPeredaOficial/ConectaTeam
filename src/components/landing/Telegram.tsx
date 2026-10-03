import { URL_BOT, URL_CANAL } from '../../lib/telegram'

// Convite para receber os alertas no Telegram (canal da região e bot por município)
export default function Telegram() {
  return (
    <section
      aria-labelledby="titulo-telegram"
      className="grid items-center gap-6 overflow-hidden rounded-3xl bg-folha-800 p-5 text-white sm:p-7 lg:grid-cols-[1fr_auto]"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-folha-200">Alertas no seu celular</p>
        <h2 id="titulo-telegram" className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          📣 Receba os alertas no Telegram
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-folha-50">
          Os alertas confirmados por especialistas saem no canal da região de Araraquara. Quer só os da sua cidade?
          Fale com o nosso bot e envie <strong>/start</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={URL_CANAL}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center rounded-xl bg-white px-5 font-semibold text-folha-800 hover:bg-folha-50"
          >
            Entrar no canal
          </a>
          <a
            href={URL_BOT}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center rounded-xl border-2 border-white px-5 font-semibold hover:bg-folha-600"
          >
            Alertas da minha cidade
          </a>
        </div>
      </div>
      <a
        href={URL_CANAL}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir o canal do Radar de Pragas no Telegram pelo QR code"
        className="mx-auto block rounded-xl bg-white p-2 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <img
          src="/qr-canal-telegram.png"
          alt="QR code do canal Radar de Pragas no Telegram"
          width={160}
          height={160}
          className="h-36 w-36 rounded-lg sm:h-40 sm:w-40"
        />
      </a>
    </section>
  )
}
