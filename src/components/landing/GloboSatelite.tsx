import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Mesh, Program, Quat, Renderer, Sphere, Texture, Transform } from 'ogl'
import limitesEstaduaisUrl from '../../assets/limites-estaduais.svg?url'
import { buscarAlertasPublicos } from '../../lib/alertasPublicos'
import type { AlertaPublico } from '../../lib/alertasPublicos'
import { nomePraga } from '../../lib/mapa'
import { tempoRelativo } from '../../lib/tempoRelativo'

const TEXTURA_TERRA = 'https://unpkg.com/three-globe@2.45.3/example/img/earth-blue-marble.jpg'
const ATUALIZAR_MS = 45_000
const ZOOM_MINIMO = 1.25
const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre', lng: -70.445, lat: -9.309 },
  { sigla: 'AL', nome: 'Alagoas', lng: -36.622, lat: -9.515 },
  { sigla: 'AM', nome: 'Amazonas', lng: -64.698, lat: -4.182 },
  { sigla: 'AP', nome: 'Amapá', lng: -51.955, lat: 1.444 },
  { sigla: 'BA', nome: 'Bahia', lng: -41.722, lat: -12.474 },
  { sigla: 'CE', nome: 'Ceará', lng: -39.618, lat: -5.091 },
  { sigla: 'DF', nome: 'Distrito Federal', lng: -47.797, lat: -15.781 },
  { sigla: 'ES', nome: 'Espírito Santo', lng: -40.671, lat: -19.574 },
  { sigla: 'GO', nome: 'Goiás', lng: -49.623, lat: -16.042 },
  { sigla: 'MA', nome: 'Maranhão', lng: -45.279, lat: -5.06 },
  { sigla: 'MG', nome: 'Minas Gerais', lng: -44.673, lat: -18.456 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', lng: -54.845, lat: -20.327 },
  { sigla: 'MT', nome: 'Mato Grosso', lng: -55.912, lat: -12.948 },
  { sigla: 'PA', nome: 'Pará', lng: -53.065, lat: -3.975 },
  { sigla: 'PB', nome: 'Paraíba', lng: -36.833, lat: -7.121 },
  { sigla: 'PE', nome: 'Pernambuco', lng: -37.997, lat: -8.326 },
  { sigla: 'PI', nome: 'Piauí', lng: -42.969, lat: -7.387 },
  { sigla: 'PR', nome: 'Paraná', lng: -51.616, lat: -24.635 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', lng: -42.652, lat: -22.189 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', lng: -36.673, lat: -5.839 },
  { sigla: 'RO', nome: 'Rondônia', lng: -62.843, lat: -10.911 },
  { sigla: 'RR', nome: 'Roraima', lng: -61.399, lat: 2.085 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', lng: -53.319, lat: -29.706 },
  { sigla: 'SC', nome: 'Santa Catarina', lng: -50.489, lat: -27.244 },
  { sigla: 'SE', nome: 'Sergipe', lng: -37.444, lat: -10.584 },
  { sigla: 'SP', nome: 'São Paulo', lng: -48.734, lat: -22.263 },
  { sigla: 'TO', nome: 'Tocantins', lng: -48.33, lat: -10.15 },
] as const

type PontoAlerta = {
  lat: number
  lng: number
  municipio: string
  total: number
  demonstracao: boolean
  alertas: AlertaPublico[]
}

type MarcadorProjetado = {
  chave: string
  x: number
  y: number
  raio: number
  pontos: PontoAlerta[]
  quantidadeAlertas: number
  demonstracao: boolean
}

const vertexTerra = `
  attribute vec3 position;
  attribute vec2 uv;
  attribute vec3 normal;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelViewMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentTerra = `
  precision mediump float;
  uniform sampler2D uTexture;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 daylight = normalize(vec3(-0.45, 0.65, 0.85));
    float light = 0.55 + 0.65 * max(dot(normalize(vNormal), daylight), 0.0);
    vec3 color = texture2D(uTexture, vUv).rgb * light;
    gl_FragColor = vec4(color, 1.0);
  }
`

function globoEstatico() {
  return (
    <div
      role="img"
      aria-label="Imagem Blue Marble da Terra com foco aproximado no Brasil"
      className="aspect-square w-full max-w-[460px] rounded-full bg-transparent"
      style={{
        backgroundImage: `url("${TEXTURA_TERRA}")`,
        backgroundPosition: '62% center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 100%',
      }}
    />
  )
}

export default function GloboSatelite() {
  const areaRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const marcadorAtivoRef = useRef<MarcadorProjetado | null>(null)
  const popupFixadoRef = useRef(false)
  const pontosRef = useRef<PontoAlerta[]>([])
  const [alertas, setAlertas] = useState<AlertaPublico[]>([])
  const [marcadorAtivo, setMarcadorAtivo] = useState<MarcadorProjetado | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [falhaGl, setFalhaGl] = useState(false)
  const [texturaCarregada, setTexturaCarregada] = useState(false)
  const [zoomExibido, setZoomExibido] = useState(3.15)
  const desenharRef = useRef<() => void>(() => {})
  const animarRef = useRef<() => void>(() => {})
  const atualizarTexturaRef = useRef<() => void>(() => {})
  const ajustarZoomRef = useRef<(passo: number) => void>(() => {})
  const centralizarBrasilRef = useRef<() => void>(() => {})
  const reduzirMovimentoRef = useRef(false)
  const pontos = useMemo<PontoAlerta[]>(() => {
    const porMunicipio = new Map<number, AlertaPublico[]>()
    alertas.forEach((alerta) => {
      porMunicipio.set(alerta.municipio_cod, [...(porMunicipio.get(alerta.municipio_cod) ?? []), alerta])
    })
    return [...porMunicipio.values()].map((lista) => ({
      lat: lista[0].municipios.lat,
      lng: lista[0].municipios.lon,
      municipio: lista[0].municipios.nome,
      total: lista.length,
      demonstracao: lista.every((alerta) => alerta.simulado),
      alertas: lista,
    }))
  }, [alertas])
  useEffect(() => {
    pontosRef.current = pontos
  }, [pontos])
  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const dados = await buscarAlertasPublicos()
        if (!ativo) return
        setAlertas(dados)
      } catch (e) {
        console.error('Falha ao carregar alertas do globo', e)
      } finally {
        if (ativo) setCarregado(true)
      }
    }
    void carregar()
    const timer = window.setInterval(carregar, ATUALIZAR_MS)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const atualizar = () => {
      reduzirMovimentoRef.current = media.matches
      if (!media.matches) animarRef.current()
    }
    atualizar()
    media.addEventListener('change', atualizar)
    return () => media.removeEventListener('change', atualizar)
  }, [])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    let tamanho = Math.floor(Math.min(area.clientWidth, area.clientHeight))
    if (!tamanho) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute(
      'aria-label',
      'Globo terrestre de satélite. Arraste ou use as setas do teclado para girar; use a roda ou mais e menos para aproximar.',
    )
    canvas.setAttribute('role', 'application')
    canvas.tabIndex = 0
    canvas.className = 'block max-w-full touch-pan-y select-none focus-visible:outline-2 focus-visible:outline-sky-300'
    canvas.style.touchAction = 'pan-y'
    const rotulosCanvas = document.createElement('canvas')
    rotulosCanvas.className = 'pointer-events-none absolute inset-0 h-full w-full'
    area.replaceChildren(canvas, rotulosCanvas)
    let ponteiroHover: { x: number; y: number } | null = null
    const marcadoresProjetadosRef: MarcadorProjetado[] = []

    let renderer: Renderer
    try {
      renderer = new Renderer({
        canvas,
        width: tamanho,
        height: tamanho,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      })
    } catch (e) {
      console.error('WebGL indisponível para o globo', e)
      requestAnimationFrame(() => setFalhaGl(true))
      return
    }

    const { gl } = renderer
    const camera = new Camera(gl, { fov: 40, near: 0.1, far: 100, aspect: 1 })
    camera.position.set(0, 0, 3.15)
    camera.lookAt([0, 0, 0])
    const scene = new Transform()
    const texture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      flipY: true,
    })
    const earthProgram = new Program(gl, {
      vertex: vertexTerra,
      fragment: fragmentTerra,
      uniforms: { uTexture: { value: texture } },
      cullFace: gl.BACK,
    })
    const earth = new Mesh(gl, {
      geometry: new Sphere(gl, { radius: 1, widthSegments: 96, heightSegments: 64 }),
      program: earthProgram,
    })
    const phi = ((-48.5 + 180) * Math.PI) / 180
    const theta = ((90 - -19) * Math.PI) / 180
    const x = -Math.cos(phi) * Math.sin(theta)
    const y = Math.cos(theta)
    const z = Math.sin(phi) * Math.sin(theta)
    earth.rotation.x = Math.atan2(y, z)
    earth.rotation.y = -Math.atan2(x, Math.hypot(y, z))
    function centralizarBrasil() {
      earth.quaternion.copy(new Quat(0, 0, 0, 1))
      earth.rotation.x = Math.atan2(y, z)
      earth.rotation.y = -Math.atan2(x, Math.hypot(y, z))
      definirMarcadorAtivo(null, false)
      desenharGlobo()
    }
    centralizarBrasilRef.current = centralizarBrasil
    scene.addChild(earth)

    const texturaCanvas = document.createElement('canvas')
    const contextoTextura = texturaCanvas.getContext('2d')
    const imagemTerra = new Image()
    const imagemEstados = new Image()
    imagemTerra.crossOrigin = 'anonymous'
    imagemTerra.decoding = 'async'
    let imagemPronta = false
    let estadosProntos = false
    let ativo = true
    let zoom = 3.15
    let modoRotulos: 'nenhum' | 'sigla' | 'nome' = 'nenhum'
    const contextoRotulos = rotulosCanvas.getContext('2d')
    function transformar(
      matriz: number[],
      vetor: [number, number, number, number],
    ): [number, number, number, number] {
      return [
        matriz[0] * vetor[0] + matriz[4] * vetor[1] + matriz[8] * vetor[2] + matriz[12] * vetor[3],
        matriz[1] * vetor[0] + matriz[5] * vetor[1] + matriz[9] * vetor[2] + matriz[13] * vetor[3],
        matriz[2] * vetor[0] + matriz[6] * vetor[1] + matriz[10] * vetor[2] + matriz[14] * vetor[3],
        matriz[3] * vetor[0] + matriz[7] * vetor[1] + matriz[11] * vetor[2] + matriz[15] * vetor[3],
      ]
    }
    function definirMarcadorAtivo(marcador: MarcadorProjetado | null, fixado = popupFixadoRef.current) {
      popupFixadoRef.current = fixado
      const anterior = marcadorAtivoRef.current
      marcadorAtivoRef.current = marcador
      if (anterior?.chave !== marcador?.chave) setMarcadorAtivo(marcador)
    }
    function posicionarPopup(marcador: MarcadorProjetado) {
      const popup = popupRef.current
      const areaElement = areaRef.current
      if (!popup || !areaElement) return
      const areaRect = areaElement.getBoundingClientRect()
      popup.style.left = `${Math.max(128, Math.min(areaRect.width - 128, marcador.x))}px`
      popup.style.top = `${Math.max(12, marcador.y - marcador.raio - 10)}px`
    }
    function buscarMarcadorNaPosicao(x: number, y: number): MarcadorProjetado | null {
      let maisProximo: MarcadorProjetado | null = null
      let menorDistancia = Number.POSITIVE_INFINITY
      marcadoresProjetadosRef.forEach((marcador) => {
        const distancia = Math.hypot(x - marcador.x, y - marcador.y)
        if (distancia <= marcador.raio + 8 && distancia < menorDistancia) {
          menorDistancia = distancia
          maisProximo = marcador
        }
      })
      return maisProximo
    }
    function desenharRotulos() {
      if (!contextoRotulos) return
      const areaElement = areaRef.current
      if (!areaElement) return
      const areaRect = areaElement.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const largura = Math.round(areaRect.width * dpr)
      const altura = Math.round(areaRect.height * dpr)
      if (rotulosCanvas.width !== largura || rotulosCanvas.height !== altura) {
        rotulosCanvas.width = largura
        rotulosCanvas.height = altura
      }
      contextoRotulos.setTransform(dpr, 0, 0, dpr, 0, 0)
      contextoRotulos.clearRect(0, 0, areaRect.width, areaRect.height)

      if (modoRotulos !== 'nenhum') {
        contextoRotulos.textAlign = 'center'
        contextoRotulos.textBaseline = 'middle'
        contextoRotulos.font =
          modoRotulos === 'nome' ? '600 10px system-ui, sans-serif' : '700 10px system-ui, sans-serif'
        contextoRotulos.lineJoin = 'round'
        contextoRotulos.lineWidth = 3
        contextoRotulos.strokeStyle = 'rgba(3, 12, 24, 0.9)'
        contextoRotulos.fillStyle = '#f0f9ff'
        ESTADOS_BRASIL.forEach((estado) => {
          const latitude = (estado.lat * Math.PI) / 180
          const phi = ((estado.lng + 180) * Math.PI) / 180
          const ponto = transformar(earth.worldMatrix, [
            -Math.cos(phi) * Math.cos(latitude),
            Math.sin(latitude),
            Math.sin(phi) * Math.cos(latitude),
            1,
          ])
          if (ponto[2] <= 0) return
          const cameraSpace = transformar(camera.viewMatrix, ponto)
          const clip = transformar(camera.projectionMatrix, cameraSpace)
          if (clip[3] <= 0) return
          const x = ((clip[0] / clip[3] + 1) * canvasRect.width) / 2 + canvasRect.left - areaRect.left
          const y = ((1 - clip[1] / clip[3]) * canvasRect.height) / 2 + canvasRect.top - areaRect.top
          if (x < 0 || x > areaRect.width || y < 0 || y > areaRect.height) return
          const nome = modoRotulos === 'nome' ? estado.nome : estado.sigla
          contextoRotulos.strokeText(nome, x, y)
          contextoRotulos.fillText(nome, x, y)
        })
      }

      const candidatos: { ponto: PontoAlerta; x: number; y: number }[] = []
      pontosRef.current.forEach((ponto) => {
        const latitude = (ponto.lat * Math.PI) / 180
        const phi = ((ponto.lng + 180) * Math.PI) / 180
        const mundo = transformar(earth.worldMatrix, [
          -Math.cos(phi) * Math.cos(latitude),
          Math.sin(latitude),
          Math.sin(phi) * Math.cos(latitude),
          1,
        ])
        if (mundo[2] <= 0) return
        const cameraSpace = transformar(camera.viewMatrix, mundo)
        const clip = transformar(camera.projectionMatrix, cameraSpace)
        if (clip[3] <= 0) return
        const x = ((clip[0] / clip[3] + 1) * canvasRect.width) / 2 + canvasRect.left - areaRect.left
        const y = ((1 - clip[1] / clip[3]) * canvasRect.height) / 2 + canvasRect.top - areaRect.top
        if (x < 0 || x > areaRect.width || y < 0 || y > areaRect.height) return
        candidatos.push({ ponto, x, y })
      })

      const marcadores = candidatos.map(({ ponto, x, y }): MarcadorProjetado => ({
        chave: ponto.alertas[0].id,
        x,
        y,
        raio: Math.min(7, 4.5 + Math.log2(ponto.total) * 0.75),
        pontos: [ponto],
        quantidadeAlertas: ponto.total,
        demonstracao: ponto.demonstracao,
      }))
      marcadoresProjetadosRef.splice(0, marcadoresProjetadosRef.length, ...marcadores)
      marcadores.forEach((marcador) => {
        contextoRotulos.beginPath()
        contextoRotulos.arc(marcador.x, marcador.y, marcador.raio + 2, 0, Math.PI * 2)
        contextoRotulos.fillStyle =         marcador.demonstracao ? 'rgba(167, 139, 250, .2)' : 'rgba(204, 6, 10, .2)'
        contextoRotulos.fill()
        contextoRotulos.beginPath()
        contextoRotulos.arc(marcador.x, marcador.y, marcador.raio, 0, Math.PI * 2)
        contextoRotulos.fillStyle = marcador.demonstracao ? '#8b5cf6' : '#cc060a'
        contextoRotulos.fill()
        contextoRotulos.lineWidth = 1
        contextoRotulos.strokeStyle = 'rgba(255,255,255,.95)'
        contextoRotulos.stroke()
        const quantidade = marcador.quantidadeAlertas
        if (quantidade > 1) {
          contextoRotulos.fillStyle = '#ffffff'
          contextoRotulos.font = '700 8px system-ui, sans-serif'
          contextoRotulos.textAlign = 'center'
          contextoRotulos.textBaseline = 'middle'
          contextoRotulos.fillText(quantidade > 99 ? '99+' : String(quantidade), marcador.x, marcador.y)
        }
      })

      const marcadorAtivo = marcadorAtivoRef.current
      if (marcadorAtivo) {
        const atualizado = marcadores.find((marcador) => marcador.chave === marcadorAtivo.chave)
        if (atualizado) {
          marcadorAtivoRef.current = atualizado
          posicionarPopup(atualizado)
        } else if (popupFixadoRef.current) definirMarcadorAtivo(null, false)
      }
      if (!popupFixadoRef.current && ponteiroHover) {
        definirMarcadorAtivo(buscarMarcadorNaPosicao(ponteiroHover.x, ponteiroHover.y), false)
      }
    }
    function desenharGlobo() {
      renderer.render({ scene, camera })
      desenharRotulos()
    }
    function atualizarTextura() {
      if (!ativo || !imagemPronta || !contextoTextura) return
      contextoTextura.drawImage(imagemTerra, 0, 0, texturaCanvas.width, texturaCanvas.height)
      contextoTextura.fillStyle = 'rgba(3, 12, 24, 0.28)'
      contextoTextura.fillRect(0, 0, texturaCanvas.width, texturaCanvas.height)

      if (estadosProntos) contextoTextura.drawImage(imagemEstados, 0, 0, texturaCanvas.width, texturaCanvas.height)

      texture.image = texturaCanvas
      texture.needsUpdate = true
      desenharGlobo()
      desenharRef.current = desenharGlobo
    }
    atualizarTexturaRef.current = atualizarTextura
    function atualizarRotulosDoZoom() {
      const novoModo = zoom <= 1.7 ? 'nome' : zoom <= 2.5 ? 'sigla' : 'nenhum'
      modoRotulos = novoModo
      desenharRotulos()
    }
    function ajustarZoom(passo: number) {
      zoom = Math.max(ZOOM_MINIMO, Math.min(4.6, zoom + passo))
      camera.position.z = zoom
      camera.lookAt([0, 0, 0])
      setZoomExibido(zoom)
      atualizarRotulosDoZoom()
      desenharGlobo()
    }
    ajustarZoomRef.current = ajustarZoom
    let arrastando = false
    const ponteiros = new Map<number, { x: number; y: number }>()
    const inicioPonteiros = new Map<number, { x: number; y: number }>()
    let vetorTrackballAnterior: [number, number, number] | null = null
    let distanciaPinch = 0
    let zoomPinch = zoom
    let animacao = 0
    let ultimoFrame = 0
    function desenhar(tempo: number) {
      if (tempo - ultimoFrame < 32) {
        animacao = requestAnimationFrame(desenhar)
        return
      }
      ultimoFrame = tempo
      if (!reduzirMovimentoRef.current && !arrastando) {
        earth.rotation.y += 0.0003
      }
      desenharGlobo()
      desenharRef.current = desenharGlobo
      animacao = reduzirMovimentoRef.current ? 0 : requestAnimationFrame(desenhar)
    }

    function iniciarAnimacao() {
      if (!reduzirMovimentoRef.current && !animacao) animacao = requestAnimationFrame(desenhar)
    }

    function iniciarImagem() {
      if (!ativo) return
      imagemPronta = true
      texturaCanvas.width = imagemTerra.naturalWidth
      texturaCanvas.height = imagemTerra.naturalHeight
      atualizarTextura()
      setTexturaCarregada(true)
      iniciarAnimacao()
    }

    imagemTerra.onload = iniciarImagem
    imagemTerra.onerror = (erroImagem) => {
      if (!ativo) return
      console.error('Falha ao carregar a textura Blue Marble do globo', erroImagem)
      setFalhaGl(true)
    }
    imagemTerra.src = TEXTURA_TERRA
    imagemEstados.onload = () => {
      if (!ativo) return
      estadosProntos = true
      atualizarTextura()
    }
    imagemEstados.onerror = (erroImagem) => {
      if (ativo) console.error('Falha ao carregar limites dos estados brasileiros', erroImagem)
    }
    imagemEstados.src = limitesEstaduaisUrl
    animarRef.current = iniciarAnimacao

    function vetorTrackball(clientX: number, clientY: number): [number, number, number] {
      const rect = canvas.getBoundingClientRect()
      const raio = Math.min(rect.width, rect.height) / 2
      const x = (clientX - rect.left - rect.width / 2) / raio
      const y = (rect.height / 2 - (clientY - rect.top)) / raio
      const distancia = Math.hypot(x, y)
      if (distancia <= 1) return [x, y, Math.sqrt(1 - distancia * distancia)]
      return [x / distancia, y / distancia, 0]
    }

    function pointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      canvas.setPointerCapture(event.pointerId)
      ponteiros.set(event.pointerId, { x: event.clientX, y: event.clientY })
      inicioPonteiros.set(event.pointerId, { x: event.clientX, y: event.clientY })
      arrastando = ponteiros.size === 1
      vetorTrackballAnterior = ponteiros.size === 1 ? vetorTrackball(event.clientX, event.clientY) : null
      if (ponteiros.size === 2) {
        const [primeiro, segundo] = [...ponteiros.values()]
        distanciaPinch = Math.hypot(segundo.x - primeiro.x, segundo.y - primeiro.y)
        zoomPinch = Number(camera.position.z)
      }
      canvas.style.cursor = arrastando ? 'grabbing' : 'zoom-in'
    }

    function selecionarMarcador(event: PointerEvent) {
      const areaElement = areaRef.current
      if (!areaElement) return
      const rect = areaElement.getBoundingClientRect()
      const marcador = buscarMarcadorNaPosicao(event.clientX - rect.left, event.clientY - rect.top)
      definirMarcadorAtivo(marcador, Boolean(marcador))
    }

    function pointerMove(event: PointerEvent) {
      if (!ponteiros.has(event.pointerId)) {
        if (event.pointerType !== 'touch') {
          const areaElement = areaRef.current
          if (!areaElement) return
          const rect = areaElement.getBoundingClientRect()
          ponteiroHover = { x: event.clientX - rect.left, y: event.clientY - rect.top }
          if (!popupFixadoRef.current) definirMarcadorAtivo(buscarMarcadorNaPosicao(ponteiroHover.x, ponteiroHover.y), false)
        }
        return
      }
      ponteiros.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (ponteiros.size === 2) {
        const [primeiro, segundo] = [...ponteiros.values()]
        const distanciaAtual = Math.hypot(segundo.x - primeiro.x, segundo.y - primeiro.y)
        if (distanciaPinch > 0) {
          zoom = Math.max(ZOOM_MINIMO, Math.min(4.6, zoomPinch * (distanciaPinch / Math.max(1, distanciaAtual))))
          camera.position.z = zoom
          camera.lookAt([0, 0, 0])
          setZoomExibido(zoom)
          atualizarRotulosDoZoom()
        }
        desenharGlobo()
        return
      }
      const vetorAtual = vetorTrackball(event.clientX, event.clientY)
      if (!vetorTrackballAnterior) {
        vetorTrackballAnterior = vetorAtual
        return
      }
      const [ax, ay, az] = vetorTrackballAnterior
      const [bx, by, bz] = vetorAtual
      const eixoX = ay * bz - az * by
      const eixoY = az * bx - ax * bz
      const eixoZ = ax * by - ay * bx
      const comprimentoEixo = Math.hypot(eixoX, eixoY, eixoZ)
      const produto = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
      if (comprimentoEixo > 1e-6) {
        const sensibilidade = Math.max(0.2, Math.min(1, (zoom / 3.15) ** 2))
        const angulo = Math.acos(produto) * sensibilidade
        const seno = Math.sin(angulo / 2) / comprimentoEixo
        const rotacao = new Quat(eixoX * seno, eixoY * seno, eixoZ * seno, Math.cos(angulo / 2))
        const orientacao = new Quat().multiply(rotacao, earth.quaternion).normalize()
        earth.quaternion.copy(orientacao)
      }
      vetorTrackballAnterior = vetorAtual
      desenharRef.current()
    }

    function pointerStart(event: PointerEvent) {
      pointerDown(event)
    }

    function pointerUp(event: PointerEvent) {
      const inicio = inicioPonteiros.get(event.pointerId)
      if (event.type === 'pointerup' && ponteiros.size === 1 && inicio) {
        if (Math.hypot(event.clientX - inicio.x, event.clientY - inicio.y) < 6) selecionarMarcador(event)
      }
      ponteiros.delete(event.pointerId)
      inicioPonteiros.delete(event.pointerId)
      arrastando = ponteiros.size === 1
      if (arrastando) {
        const restante = [...ponteiros.values()][0]
        vetorTrackballAnterior = vetorTrackball(restante.x, restante.y)
      } else {
        vetorTrackballAnterior = null
      }
      canvas.style.cursor = 'grab'
      if (ponteiros.size) return
      if (reduzirMovimentoRef.current) {
        desenharGlobo()
      }
    }

    function pointerLeave(event: PointerEvent) {
      if (event.relatedTarget instanceof Node && popupRef.current?.contains(event.relatedTarget)) return
      ponteiroHover = null
      if (!popupFixadoRef.current) definirMarcadorAtivo(null, false)
      canvas.style.cursor = 'grab'
    }

    function wheel(event: WheelEvent) {
      event.preventDefault()
      ajustarZoom(Math.sign(event.deltaY) * 0.18)
    }

    function teclado(event: KeyboardEvent) {
      const passo = 0.08
      if (event.key === 'ArrowLeft') earth.rotation.y -= passo
      else if (event.key === 'ArrowRight') earth.rotation.y += passo
      else if (event.key === 'ArrowUp') earth.rotation.x = Math.max(-1.35, earth.rotation.x - passo)
      else if (event.key === 'ArrowDown') earth.rotation.x = Math.min(1.35, earth.rotation.x + passo)
      else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        ajustarZoom(-0.18)
        return
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        ajustarZoom(0.18)
        return
      }
      else return
      event.preventDefault()
      desenharGlobo()
    }

    function redimensionar() {
      const areaAtual = areaRef.current
      if (!areaAtual) return
      tamanho = Math.floor(Math.min(areaAtual.clientWidth, areaAtual.clientHeight))
      if (!tamanho) return
      renderer.setSize(tamanho, tamanho)
      camera.perspective({ aspect: 1 })
      desenharRef.current()
    }

    canvas.addEventListener('pointerdown', pointerStart)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerUp)
    canvas.addEventListener('pointerleave', pointerLeave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('keydown', teclado)
    window.addEventListener('resize', redimensionar)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionar) : null
    observer?.observe(area)
    canvas.style.cursor = 'grab'

    return () => {
      ativo = false
      cancelAnimationFrame(animacao)
      canvas.removeEventListener('pointerdown', pointerStart)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerUp)
      canvas.removeEventListener('pointerleave', pointerLeave)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('keydown', teclado)
      window.removeEventListener('resize', redimensionar)
      observer?.disconnect()
      imagemTerra.onload = null
      imagemTerra.onerror = null
      imagemEstados.onload = null
      imagemEstados.onerror = null
      earth.geometry.remove()
      earthProgram.remove()
      gl.deleteTexture(texture.texture)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
      desenharRef.current = () => {}
      animarRef.current = () => {}
      atualizarTexturaRef.current = () => {}
      ajustarZoomRef.current = () => {}
      centralizarBrasilRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    pontosRef.current = pontos
    atualizarTexturaRef.current()
  }, [pontos])

  function centralizarBrasil() {
    centralizarBrasilRef.current()
  }
  const alertasDoMarcador = marcadorAtivo?.pontos.flatMap((ponto) => ponto.alertas).slice(0, 4) ?? []

  return (
    <div className="absolute inset-0 overflow-hidden bg-transparent text-white">
      <div
        ref={areaRef}
        className="absolute inset-0 flex items-center justify-center"
        aria-label="Globo satelital interativo, centralizado no Brasil"
      >
        {marcadorAtivo && (
          <div
            ref={popupRef}
            role="status"
            style={{
              left: `clamp(128px, ${marcadorAtivo.x}px, calc(100% - 128px))`,
              top: `${Math.max(12, marcadorAtivo.y - marcadorAtivo.raio - 10)}px`,
            }}
            className="absolute z-20 w-[min(15rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-full rounded-xl border border-white/20 bg-[#071522]/95 p-3 text-white shadow-xl backdrop-blur"
          >
            <button
              type="button"
              aria-label="Fechar detalhes dos alertas"
              onClick={() => {
                popupFixadoRef.current = false
                marcadorAtivoRef.current = null
                setMarcadorAtivo(null)
              }}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-lg text-white/70 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
            <p className="pr-7 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {marcadorAtivo.demonstracao ? 'Dados de demonstração · não são alertas reais' : 'Alertas confirmados'}
            </p>
            <p className="mt-1 pr-5 text-xs font-semibold text-white/80">
              {marcadorAtivo.pontos[0].municipio} · {marcadorAtivo.quantidadeAlertas}{' '}
              {marcadorAtivo.quantidadeAlertas === 1 ? 'alerta' : 'alertas'}
            </p>
            <ul className="mt-2 space-y-2">
              {alertasDoMarcador.map((alerta) => (
                <li key={alerta.id} className="border-t border-white/10 pt-2">
                  <p className="text-xs font-bold">{nomePraga(alerta)}</p>
                  <p className="mt-0.5 text-[10px] text-white/70">
                    {alerta.cultura} · {alerta.municipios.nome} · {tempoRelativo(alerta.enviado_em)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {falhaGl && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">{globoEstatico()}</div>
      )}
      {!texturaCarregada && !falhaGl && (
        <p         className="pointer-events-none absolute inset-x-0 top-1/2 z-[2] -translate-y-1/2 text-center text-xs text-gray-500">
          Carregando a esfera de satélite…
        </p>
      )}

      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 sm:right-5">
        <button
          type="button"
          aria-label="Aproximar globo"
          onClick={() => ajustarZoomRef.current(-0.25)}
          disabled={zoomExibido <= ZOOM_MINIMO}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-folha-200 bg-white/90 text-xl font-semibold text-folha-900 shadow backdrop-blur hover:bg-folha-50 disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Afastar globo"
          onClick={() => ajustarZoomRef.current(0.25)}
          disabled={zoomExibido >= 4.6}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-folha-200 bg-white/90 text-xl font-semibold text-folha-900 shadow backdrop-blur hover:bg-folha-50 disabled:opacity-40"
        >
          −
        </button>
      </div>

      <button
        type="button"
        onClick={centralizarBrasil}
        aria-label="Centralizar Brasil no globo"
        className="absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-folha-200 bg-white/90 text-sm text-folha-900 shadow backdrop-blur hover:bg-folha-50 sm:bottom-5 sm:left-5"
      >
        <span aria-hidden="true">⌖</span>
      </button>
      <p className="sr-only" aria-live="polite">
        {alertas.length
          ? `Alertas recentes em ${pontos.length} municípios: ${alertas
              .slice(0, 5)
              .map((alerta) => `${nomePraga(alerta)} em ${alerta.municipios.nome}`)
              .join('; ')}`
          : carregado
            ? 'Nenhum alerta publicado nos últimos 30 dias.'
            : 'Carregando alertas recentes.'}
      </p>
    </div>
  )
}
