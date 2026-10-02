import { URL_BOT, URL_CANAL } from '../../lib/telegram'

// Convite para receber os alertas no Telegram (canal da região e bot por município)
export default function Telegram() {
  return (
    <section
      aria-labelledby="titulo-telegram"
      className="grid items-center gap-4 rounded-2xl bg-folha-700 p-5 text-white md:grid-cols-[1fr_auto]"
    >
      <div>
        <h2 id="titulo-telegram" className="text-xl font-bold">
          📣 Receba os alertas no Telegram
        </h2>
        <p className="mt-2 text-folha-50">
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
      <img
        src="/qr-canal-telegram.png"
        alt="QR code do canal Radar de Pragas no Telegram"
        width={160}
        height={160}
        className="mx-auto rounded-xl bg-white p-2"
      />
    </section>
  )
}
