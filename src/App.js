import React, { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import Tone from 'tone'

const synth = new Tone.Synth().toMaster()

function isFaceDectionModelLoaded() {
  return !!faceapi.nets.tinyFaceDetector.params
}

function App() {
  const videoEl = useRef(null)
  const canvas = useRef(null)
  const videoCanvas = useRef(null)
  const viewerCanvas = useRef(null)
  const [soundMap, setSoundMap] = useState(new SoundMap())

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json')
      .then(() => navigator.mediaDevices.getUserMedia({ video: {} }))
      .then(stream => {
        const v = videoEl.current
        v.srcObject = stream

        v.addEventListener('play', () => {
          canvas.current.width = v.videoWidth
          canvas.current.height = v.videoHeight
          videoCanvas.current.width = v.videoWidth
          videoCanvas.current.height = v.videoHeight
          viewerCanvas.current.width = v.videoWidth
          viewerCanvas.current.height = v.videoHeight
        }, {
          once: true
        })
      })
  }, [])

  return (
    <div>
      <video
        ref={videoEl}
        onLoadedMetadata={(e) => onPlay(videoEl.current, canvas.current, videoCanvas.current, e)}
        autoPlay
        muted
        style={{
          visibility: 'hidden'
        }}
      ></video>
      <canvas ref={canvas} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 100
      }} />
      <canvas ref={videoCanvas} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10
      }} />
      <button onClick={() => onCapture(videoCanvas.current, viewerCanvas.current, sm => {
        setSoundMap(sm)
        console.log(sm)
      })
      }>찰칵</button>
      <canvas
        ref={viewerCanvas}
        onClick={e => {
          const { x, y } = getMouseCoordinate(e, viewerCanvas.current)
          soundMap.sound(x, y)
        }}/>
    </div>
  )
}

function drawImage (canvas, image) {
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
}

async function onPlay (video, canvas, videoCanvas, event) {
  event.persist()
  const ctx = canvas.getContext('2d')

  try {
    if (video.paused || video.ended || !isFaceDectionModelLoaded()) {
      return setTimeout(() => onPlay(video, canvas, videoCanvas, event))
    }

    const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
      inputSize: 128,
      scoreThreshold: 0.5
    }))

    drawImage(videoCanvas, event.target)

    if (result) {
      const dims = faceapi.matchDimensions(canvas, video, true)
      const { box } = faceapi.resizeResults(result, dims)
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'white'
      ctx.fillRect(box.x, box.y, box.width, box.height)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    setTimeout(() => onPlay(video, canvas, videoCanvas, event))
  } catch (err) {
    console.error(err)
  }
}

async function onCapture (canvas, viewerCanvas, setSoundMap) {
  const ctx = viewerCanvas.getContext('2d')
  ctx.drawImage(canvas, 0, 0)
  await setSoundMap(new SoundMap(ctx.getImageData(0, 0, viewerCanvas.width, viewerCanvas.height)))
}

function getMouseCoordinate (event, canvas) {
  let totalOffsetX = 0
  let totalOffsetY = 0
  let canvasX = 0
  let canvasY = 0

  do {
      totalOffsetX += canvas.offsetLeft - canvas.scrollLeft
      totalOffsetY += canvas.offsetTop - canvas.scrollTop
  }
  while (canvas === canvas.offsetParent)

  canvasX = event.pageX - totalOffsetX
  canvasY = event.pageY - totalOffsetY

  return {
    x: canvasX,
    y: canvasY
  }
}

class RGB {
  constructor (r = 0, g = 0, b = 0) {
    this.r = r
    this.g = g
    this.b = b
  }

  divide (num) {
    return new RGB(
      ...[
        this.r,
        this.g,
        this.b
      ].map(v => ~~(v / num))
    )
  }

  convertToTone () {
    const convert = v => v.toString(16).padStart(2, 0)
    const hex = parseInt(convert(this.r) + convert(this.g) + convert(this.b), 16)
    if(0xeeeeee < hex && hex <=0xffffff) {
      return 'C5'
    } else if (0xdddddd < hex && hex <= 0xeeeeee) {
      return 'B4'
    } else if (0xcccccc < hex && hex <= 0xdddddd) {
      return 'A4'
    } else if (0xbbbbbb < hex && hex <= 0xcccccc) {
      return 'G4'
    } else if (0xaaaaaa < hex && hex <= 0xbbbbbb) {
      return 'F4'
    } else if (0x999999 < hex && hex <= 0xaaaaaa) {
      return 'E4'
    } else if (0x888888 < hex && hex <= 0x999999) {
      return 'D4'
    } else if (0x777777 < hex && hex <= 0x888888) {
      return 'C4'
    } else if (0x666666 < hex && hex <= 0x777777) {
      return 'B3'
    } else if (0x555555 < hex && hex <= 0x666666) {
      return 'A3'
    } else if (0x444444 < hex && hex <= 0x555555) {
      return 'G3'
    } else if (0x333333 < hex && hex <= 0x444444) {
      return 'F3'
    } else if (0x222222 < hex && hex <= 0x333333) {
      return 'E3'
    } else if (0x111111 < hex && hex <= 0x222222) {
      return 'D3'
    } else if (0x000000 < hex && hex <= 0x111111) {
      return 'C3'
    }
  }
}


class SoundMap {
  constructor (imageData) {
    if (!imageData) return
    this.offsetSize = ~~(imageData.data.length / 3)
    this.width = imageData.width
    this.height = imageData.height
    this.map = this.processImage(imageData)
    console.log(this)
  }

  processImage (imageData) {
    const batchSize = 50
    const result = [new RGB(), new RGB(), new RGB()]
    console.log(imageData.data.length, imageData.width, imageData.height)

    for (let j = 0; j < 3; j++) {
      const sumRGB = new RGB()
      let count = 0

      for (let i = 0; i < this.offsetSize; i += 4 * batchSize) {
        ++count
        console.log(this.offsetSize * j + i)
        sumRGB.r += imageData.data[this.offsetSize * j + i]
        sumRGB.g += imageData.data[this.offsetSize * j + i + 1]
        sumRGB.b += imageData.data[this.offsetSize * j + i + 2]
      }

      result[j] = sumRGB.divide(count)
    }

    return result
  }

  sound (x, y) {
    console.log(y)
    console.log(this.height)
    if (y < (this.height) / 3) {
      synth.triggerAttackRelease(this.map[0].convertToTone(), '8n')
      console.log(1)
    } else if (y < (this.height / 3) * 2) {
      synth.triggerAttackRelease(this.map[1].convertToTone(), '8n')
      console.log(2)
    } else {
      synth.triggerAttackRelease(this.map[2].convertToTone(), '8n')
      console.log(3)
    }
  }
}

export default App
