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
    wheel: 0,
    dragging: false,
    pointerLocked: false,
    ignoreLookUntil: 0,
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

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0 && !input.pointerLocked) input.dragging = true;
  });
  window.addEventListener("mouseup", () => {
    input.dragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (performance.now() < input.ignoreLookUntil) return;
    const dx = Math.max(-18, Math.min(18, e.movementX)) * 0.00085;
    const dy = Math.max(-18, Math.min(18, e.movementY)) * 0.00085;
    if (input.pointerLocked) {
      input.mouseDx += dx;
      input.mouseDy += dy;
    } else if (input.dragging) {
      input.orbitDx += dx;
      input.orbitDy += dy;
    }
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      input.wheel += e.deltaY;
    },
    { passive: false }
  );

  document.addEventListener("pointerlockchange", () => {
    input.pointerLocked = document.pointerLockElement === canvas;
    if (input.pointerLocked) {
      input.ignoreLookUntil = performance.now() + 280;
      input.mouseDx = 0;
      input.mouseDy = 0;
    }
  });

  return {
    input,
    consumeLook() {
      const mx = input.mouseDx;
      const my = input.mouseDy;
      input.mouseDx = 0;
      input.mouseDy = 0;
      return { mx, my };
    },
    consumeOrbit() {
      const ox = input.orbitDx;
      const oy = input.orbitDy;
      const wheel = input.wheel;
      input.orbitDx = 0;
      input.orbitDy = 0;
      input.wheel = 0;
      return { ox, oy, wheel };
    },
    lock() {
      input.ignoreLookUntil = performance.now() + 280;
      input.mouseDx = 0;
      input.mouseDy = 0;
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(() => {});
    },
    unlock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
