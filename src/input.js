export function createInput(canvas) {
  const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    lunge: false,
    mouseDx: 0,
    mouseDy: 0,
    orbitDx: 0,
    orbitDy: 0,
    panDx: 0,
    panDy: 0,
    wheel: 0,
    dragging: false,
    panning: false,
  };

  const keys = {
    KeyW: "forward",
    KeyS: "back",
    ArrowUp: "forward",
    ArrowDown: "back",
    KeyA: "left",
    KeyD: "right",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyQ: "down",
    KeyE: "up",
    ShiftLeft: "boost",
    ShiftRight: "boost",
  };

  let lastX = 0;
  let lastY = 0;
  let dragPointer = null;

  function isPan(e) {
    return e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey);
  }

  function endDrag() {
    dragPointer = null;
    input.dragging = false;
    input.panning = false;
    canvas.classList.remove("is-dragging", "is-panning");
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) input.lunge = true;
      return;
    }
    const bind = keys[e.code];
    if (bind) input[bind] = true;
  });

  window.addEventListener("keyup", (e) => {
    const bind = keys[e.code];
    if (bind) input[bind] = false;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button > 2) return;
    dragPointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    if (isPan(e)) {
      input.panning = true;
      input.dragging = false;
      canvas.classList.add("is-panning");
    } else {
      input.dragging = true;
      input.panning = false;
      canvas.classList.add("is-dragging");
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* untrusted / already released */
    }
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (dragPointer !== e.pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dx && !dy) return;
    if (input.panning) {
      input.panDx += dx;
      input.panDy += dy;
    } else {
      input.orbitDx += dx;
      input.orbitDy += dy;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (dragPointer === e.pointerId) endDrag();
  });
  canvas.addEventListener("pointercancel", (e) => {
    if (dragPointer === e.pointerId) endDrag();
  });
  canvas.addEventListener("lostpointercapture", () => {
    if (dragPointer != null) endDrag();
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (e.cancelable) e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 400;
      input.wheel += dy;
    },
    { passive: false }
  );

  return {
    input,
    consumePointer() {
      const ox = input.orbitDx;
      const oy = input.orbitDy;
      const px = input.panDx;
      const py = input.panDy;
      const wheel = input.wheel;
      input.orbitDx = 0;
      input.orbitDy = 0;
      input.panDx = 0;
      input.panDy = 0;
      input.wheel = 0;
      return {
        ox,
        oy,
        px,
        py,
        wheel,
        dragging: input.dragging,
        panning: input.panning,
      };
    },
  };
}
