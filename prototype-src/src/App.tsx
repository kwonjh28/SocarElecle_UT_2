import { useMemo, useRef, useState } from "react"

const A = `${import.meta.env.BASE_URL}assets`

type Bike = {
  id: string
  battery: number
  distance: string
  range: string
  minutes: string
  recent: boolean
  photo: string
  photoCrop?: "screen"
  x: number
  y: number
}

type MapPan = {
  x: number
  y: number
}

type BikePinProps = {
  battery: number
  selected: boolean
}

const bikes: Bike[] = [
  {
    id: "10201945",
    battery: 94,
    distance: "212m",
    range: "42.0km",
    minutes: "128분",
    recent: false,
    photo: "bbf5b.png",
    x: 108,
    y: 68,
  },
  {
    id: "10201967",
    battery: 43,
    distance: "80m",
    range: "22.0km",
    minutes: "66분",
    recent: true,
    photo: "96ccc.png",
    x: 211,
    y: 183,
  },
  {
    id: "10201923",
    battery: 31,
    distance: "72m",
    range: "16.0km",
    minutes: "33분",
    recent: true,
    photo: "725a2.png",
    x: 187,
    y: 409,
  },
  {
    id: "10201951",
    battery: 73,
    distance: "96m",
    range: "32.0km",
    minutes: "96분",
    recent: false,
    photo: "c1173.png",
    photoCrop: "screen",
    x: 69,
    y: 284,
  },
  {
    id: "10201989",
    battery: 83,
    distance: "103m",
    range: "39.0km",
    minutes: "108분",
    recent: true,
    photo: "63249.png",
    x: 293,
    y: 176,
  },
]

const overlayAssets = [
  ["4000d.svg", 116.61, 66.9, 191.547, 407.3],
  ["64eff.svg", 48.73, 164.26, 57.885, 116.296],
  ["94799.svg", -45.47, 11.12, 150.501, 178.391],
  ["e41f9.svg", 38.2, -45.18, 154.711, 176.813],
  ["8ff03.svg", -77.57, 66.38, 173.129, 260.483],
  ["90949.svg", -325.42, -192, 1101.395, 827.23],
  ["67ca4.svg", 698.09, 453.68, 76.303, 221.016],
  ["ab767.svg", -243.33, 708.38, 132.609, 32.626],
  ["043a6.svg", -326.47, 491.04, 159.447, 247.853],
  ["304e5.svg", -120.19, 343.17, 301.002, 394.671],
  ["72f7e.svg", -26.52, 482.1, 803.023, 260.482],
  ["67f1f.svg", -327, 104.27, 390.987, 571.484],
] as const

function Header() {
  return (
    <header className="app-header">
      <button className="menu-button" aria-label="메뉴 열기">
        <span />
        <span />
        <span />
      </button>
      <strong>쏘카일레클</strong>
    </header>
  )
}

function FilterIcon({
  type,
  active,
}: {
  type: "recent" | "near" | "charge"
  active: boolean
}) {
  if (type === "charge") {
    return (
      <span
        className="filter-icon charge"
        data-active={active}
        aria-hidden="true"
      >
        <img src={`${A}/98211.svg`} alt="" />
      </span>
    )
  }

  const sources = {
    recent: active ? "b3a67.svg" : "d0df3.svg",
    near: active ? "dc8fc.svg" : "1f0e9.svg",
  }
  return (
    <img
      className={`filter-icon ${type}`}
      src={`${A}/${sources[type]}`}
      alt=""
    />
  )
}

function Filters({
  recent,
  near,
  charged,
  toggle,
}: {
  recent: boolean
  near: boolean
  charged: boolean
  toggle: (name: "recent" | "near" | "charged") => void
}) {
  return (
    <div className="filter-panel">
      <button
        className="pass-card"
        onClick={() => alert("구독패스 요금 안내를 준비 중이에요.")}
      >
        <span>
          매일 30분 구독패스 <b>28분</b> 남음
        </span>
        <u>요금안내</u>
      </button>
      <div className="filter-row" aria-label="자전거 필터">
        <button
          className={recent ? "active" : ""}
          onClick={() => toggle("recent")}
          aria-pressed={recent}
        >
          <FilterIcon type="recent" active={recent} />
          최근 정비
        </button>
        <button
          className={near ? "active" : ""}
          onClick={() => toggle("near")}
          aria-pressed={near}
        >
          <FilterIcon type="near" active={near} />
          100m이내
        </button>
        <button
          className={charged ? "active" : ""}
          onClick={() => toggle("charged")}
          aria-pressed={charged}
        >
          <FilterIcon type="charge" active={charged} />
          50%이상
        </button>
      </div>
    </div>
  )
}

function BikePin({ battery, selected }: BikePinProps) {
  const chargeColor = battery >= 50 ? "#39DB01" : "#FFAA01"
  const chargeWidth = battery >= 70 ? 12 : 8
  const pinPath =
    "M33 10C44.598 10 54 19.402 54 31C54 41.6631 46.0524 50.4689 35.7578 51.8193L33 56L30.2412 51.8193C19.9471 50.4684 12 41.6628 12 31C12 19.402 21.402 10 33 10Z"

  return (
    <svg
      className="bike-pin"
      width="66"
      height="70"
      viewBox="0 0 66 70"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="bike-pin-shadow"
          x="0"
          y="0"
          width="66"
          height="70"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodOpacity="0.25" />
        </filter>
      </defs>
      {selected ? (
        <path
          d={pinPath}
          fill="white"
          stroke="#374553"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path d={pinPath} fill="white" filter="url(#bike-pin-shadow)" />
      )}
      <g className="bike-glyph">
        <path
          d="M37.7674 24.4022L32.6917 30.7254C32.4114 31.0746 31.9877 31.2778 31.5399 31.2778M37.7674 24.4022L40.7778 31.2778M37.7674 24.4022L35.7604 19M24.7222 31.2778H31.5399M31.5399 31.2778L28.0278 24.4022"
          stroke="#008BFE"
          strokeWidth="1.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M25.6667 23.7222H29.4444"
          stroke="black"
          strokeWidth="1.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M33.2222 19H36.0556"
          stroke="black"
          strokeWidth="1.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="24.7222"
          cy="31.2778"
          r="3.9222"
          stroke="black"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="40.7778"
          cy="31.2778"
          r="3.9222"
          stroke="black"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <rect x="24" y="38" width="17" height="6" rx="3" fill="#E9EBED" />
      <rect
        x="25"
        y="39"
        width={chargeWidth}
        height="4"
        rx="2"
        fill={chargeColor}
      />
    </svg>
  )
}

function BikeMarker({
  bike,
  selected,
  visible,
  onSelect,
}: {
  bike: Bike
  selected: boolean
  visible: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`bike-marker ${selected ? "selected" : ""} ${
        visible ? "visible" : "filtered-out"
      }`}
      style={{ left: bike.x, top: bike.y }}
      onClick={onSelect}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={`${bike.distance} 거리의 자전거, 배터리 ${bike.battery}%`}
    >
      <div className="marker-distance-slot">
        {selected && <span>{bike.distance}</span>}
      </div>
      <div className="marker-art">
        <BikePin battery={bike.battery} selected={selected} />
      </div>
    </button>
  )
}

function Map({
  visibleBikes,
  selected,
  onSelect,
  offsetX,
  pan,
  onPanChange,
}: {
  visibleBikes: Bike[]
  selected: Bike | null
  onSelect: (bike: Bike) => void
  offsetX: number
  pan: MapPan
  onPanChange: (pan: MapPan) => void
}) {
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    pan: MapPan
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

  const stopDragging = (pointerId: number, target: HTMLElement) => {
    if (drag.current?.pointerId !== pointerId) return
    if (target.hasPointerCapture(pointerId))
      target.releasePointerCapture(pointerId)
    drag.current = null
    setDragging(false)
  }

  return (
    <main
      className={`map ${dragging ? "dragging" : ""}`}
      aria-label="주변 자전거 지도. 드래그하거나 방향키로 조금 이동할 수 있습니다."
      tabIndex={0}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          (event.target as HTMLElement).closest("button")
        )
          return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          pan,
        }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        onPanChange({
          x: clamp(current.pan.x + event.clientX - current.startX, -32, 32),
          y: clamp(current.pan.y + event.clientY - current.startY, -24, 24),
        })
      }}
      onPointerUp={(event) =>
        stopDragging(event.pointerId, event.currentTarget)
      }
      onPointerCancel={(event) =>
        stopDragging(event.pointerId, event.currentTarget)
      }
      onKeyDown={(event) => {
        const steps: Partial<Record<typeof event.key, MapPan>> = {
          ArrowLeft: { x: -6, y: 0 },
          ArrowRight: { x: 6, y: 0 },
          ArrowUp: { x: 0, y: -6 },
          ArrowDown: { x: 0, y: 6 },
        }
        const step = steps[event.key]
        if (!step) return
        event.preventDefault()
        onPanChange({
          x: clamp(pan.x + step.x, -32, 32),
          y: clamp(pan.y + step.y, -24, 24),
        })
      }}
    >
      <div
        className="map-world"
        style={{ marginLeft: offsetX + pan.x, top: pan.y }}
      >
        <img className="map-image" src={`${A}/50487.png`} alt="" />
        {overlayAssets.map(([src, left, top, width, height]) => (
          <img
            key={src}
            className="map-overlay"
            src={`${A}/${src}`}
            alt=""
            style={{ left, top, width, height }}
          />
        ))}
        <img className="my-location" src={`${A}/95777.svg`} alt="현재 위치" />
        {bikes.map((bike) => (
          <BikeMarker
            key={bike.id}
            bike={bike}
            selected={selected?.id === bike.id}
            visible={visibleBikes.some(
              (visibleBike) => visibleBike.id === bike.id,
            )}
            onSelect={() => onSelect(bike)}
          />
        ))}
      </div>
    </main>
  )
}

function LocateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="locate-button"
      aria-label="내 위치로 이동"
      onClick={onClick}
    >
      <span />
    </button>
  )
}

function DefaultSheet({
  visible,
  notify,
}: {
  visible: boolean
  notify: (message: string) => void
}) {
  return (
    <section
      className={`default-sheet ${visible ? "sheet-visible" : "sheet-hidden"}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="quick-links">
        <span>▭&nbsp; NH체크카드</span>
        <button onClick={() => notify("둘러보기 화면으로 이동합니다.")}>
          패스&nbsp; <b>둘러보기 ›</b>
        </button>
      </div>
      <button
        className="scan-button"
        onClick={() => notify("QR 스캐너를 열었어요.")}
      >
        <span className="scan-icon" /> 기기 QR 스캔하기
      </button>
    </section>
  )
}

function BatteryIcon({ value }: { value: number }) {
  const assets: Record<number, string> = {
    94: "59afd.svg",
    83: "d03d3.svg",
    73: "7fa19.svg",
    43: "89e19.svg",
    31: "609b8.svg",
  }
  const asset = assets[value] ?? "59afd.svg"
  return <img className="battery-asset" src={`${A}/${asset}`} alt="" />
}

function DetailSheet({
  bike,
  visible,
  notify,
}: {
  bike: Bike
  visible: boolean
  notify: (message: string) => void
}) {
  const [ringing, setRinging] = useState(false)

  return (
    <section
      className={`detail-sheet ${visible ? "sheet-visible" : "sheet-hidden"}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="range-pill">
        <span>{bike.range}</span>
        <span>{bike.minutes} 이용가능</span>
      </div>
      <div className="bike-info" key={bike.id}>
        <div className="bike-photo">
          <div className="bike-photo-frame">
            <img
              className={bike.photoCrop === "screen" ? "screen-crop" : ""}
              src={`${A}/${bike.photo}`}
              alt="선택한 자전거 사진"
            />
          </div>
          <small>3.0</small>
        </div>
        <div className="bike-meta">
          <div className="battery">
            <BatteryIcon value={bike.battery} />
            <strong>{bike.battery}%</strong>
          </div>
          <div className="tags">
            <span>{bike.id}</span>
            {bike.recent && <span>최근 정비</span>}
          </div>
        </div>
        <button
          className={`ring-button ${ringing ? "ringing" : ""}`}
          onClick={() => setRinging((value) => !value)}
        >
          <img src={`${A}/8afd7.svg`} alt="" />
          {ringing ? "소리 끄기" : "소리내기"}
        </button>
      </div>
      <div className="detail-actions">
        <button
          className="report"
          onClick={() => notify("신고 화면을 열었어요.")}
        >
          신고하기
        </button>
        <button
          className="reserve"
          onClick={() => notify(`${bike.id} 자전거를 예약했어요.`)}
        >
          예약하기
        </button>
        <button
          className="unlock"
          onClick={() => notify("잠금 해제를 시작합니다.")}
        >
          바로 잠금해제
        </button>
      </div>
    </section>
  )
}

export default function App() {
  const [recent, setRecent] = useState(false)
  const [near, setNear] = useState(false)
  const [charged, setCharged] = useState(false)
  const [selected, setSelected] = useState<Bike | null>(null)
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 })
  const [toast, setToast] = useState("")

  const visibleBikes = useMemo(
    () =>
      bikes.filter(
        (bike) =>
          (!recent || bike.recent) &&
          (!near || Number.parseInt(bike.distance) <= 100) &&
          (!charged || bike.battery >= 50),
      ),
    [recent, near, charged],
  )

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2200)
  }

  const toggle = (name: "recent" | "near" | "charged") => {
    setSelected(null)
    if (name === "recent") setRecent((value) => !value)
    if (name === "near") setNear((value) => !value)
    if (name === "charged") setCharged((value) => !value)
  }

  return (
    <div className={`app ${selected ? "has-selection" : ""}`}>
      <Header />
      <Map
        visibleBikes={visibleBikes}
        selected={selected}
        onSelect={setSelected}
        offsetX={recent ? (near ? -15 : -28) : 0}
        pan={mapPan}
        onPanChange={setMapPan}
      />
      <Filters recent={recent} near={near} charged={charged} toggle={toggle} />
      <LocateButton
        onClick={() => {
          setSelected(null)
          setMapPan({ x: 0, y: 0 })
          notify("현재 위치로 지도를 이동했어요.")
        }}
      />
      <DefaultSheet visible={!selected} notify={notify} />
      <DetailSheet
        bike={selected ?? bikes[0]}
        visible={Boolean(selected)}
        notify={notify}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
