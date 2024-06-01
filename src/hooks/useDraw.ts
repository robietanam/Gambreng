import { useEffect, useRef, useState } from 'react'

export const useDraw = (onDraw: ({ ctx, currentPoint, prevPoint }: Draw) => void) => {
  const [mouseDown, setMouseDown] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevPoint = useRef<null | Point>(null)

  const onMouseDown = () => setMouseDown(true)
  const onTouchStart = () => setMouseDown(true)

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!mouseDown) return
      const currentPoint = computePointInCanvas(e)
  
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !currentPoint) return

      onDraw({ ctx, currentPoint, prevPoint: prevPoint.current })
      prevPoint.current = currentPoint
    }

    const handlerTouch = (e: TouchEvent) => {
      if (!mouseDown) return
      var touch = e.touches[0];
      var mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      const currentPoint = computePointInCanvas(mouseEvent)
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx || !currentPoint) return

      onDraw({ ctx, currentPoint, prevPoint: prevPoint.current })
      prevPoint.current = currentPoint
    }

    const computePointInCanvas = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      return { x, y }
    }

    const mouseUpHandler = () => {
      setMouseDown(false)
      prevPoint.current = null
    }
    

    // Add event listeners
    canvasRef.current?.addEventListener('mousemove', handler)
    canvasRef.current?.addEventListener('touchmove', handlerTouch)
    window.addEventListener('mouseup', mouseUpHandler)
    window.addEventListener('touchend', mouseUpHandler)

    // Remove event listeners
    return () => {
      canvasRef.current?.removeEventListener('mousemove', handler)
      canvasRef.current?.removeEventListener('touchmove', handlerTouch)
      window.removeEventListener('mouseup', mouseUpHandler)
      window.removeEventListener('touchend', mouseUpHandler)
    }
  }, [onDraw])

  return { canvasRef, onMouseDown, onTouchStart ,clear }
}
