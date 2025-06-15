/* 2‑D Math Visualizer
 * Requires math.js loaded globally.
 */

document.addEventListener('DOMContentLoaded', () => {
  // MARK: Element references

  const canvas      = document.getElementById('viewer-canvas');
  const ctx         = canvas.getContext('2d');
  const textarea    = document.getElementById('formula-editor');

  const zoomSlider  = document.getElementById('zoom-slider');
  const gridToggle  = document.getElementById('grid-toggle');
  const resetBtn    = document.getElementById('reset-btn');
  const exportBtn   = document.getElementById('export-btn');

  const overlay     = document.getElementById('overlay-layer');   // hides UI on export
  const errorIndicator = document.createElement('span');
  errorIndicator.id = 'error-indicator';
  errorIndicator.style.color = 'red';
  errorIndicator.style.marginLeft = '10px';
  overlay.appendChild(errorIndicator);
  const inputPane   = document.getElementById('input-pane');
  const renderPane  = document.getElementById('render-pane');

  // MARK: Camera state

  const camera = {
    panX : 0,
    panY : 0,
    zoom : 1
  };

  // MARK: Canvas sizing / DPR

  function resizeCanvas () {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // MARK: Pan (mouse/touch)

  let dragging = false, startX = 0, startY = 0;

  canvas.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startY   = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('mousemove', e => {
    if (!dragging) return;
    camera.panX += (e.clientX - startX) / camera.zoom;
    camera.panY += (e.clientY - startY) / camera.zoom;
    startX = e.clientX;
    startY = e.clientY;
    draw();
  });

  // MARK: Zoom (slider/wheel)

  function setZoom (z) {
    camera.zoom = z;
    draw();
  }

  zoomSlider.addEventListener('input', e => setZoom(+e.target.value));

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor   = 1 + (-e.deltaY * 0.001);
    const newZoom  = Math.min(10, Math.max(0.1, camera.zoom * factor));
    zoomSlider.value = newZoom;
    setZoom(newZoom);
  }, { passive: false });

  // MARK: Parser helpers

  function parseLines(raw) {
    const allowedProps = new Set(['stroke','width','fill','alpha']);
    const blocks = [];
    const regex = /@\{([\s\S]*?)\}/g;
    let match, idx = 0;
    while ((match = regex.exec(raw))) {
      const content = match[1].trim();
      const obj = { idx: idx++, errors: [], stroke: undefined, width: undefined, fill: undefined, alpha: undefined };
      let exprPart, propsPart;
      const propSplitMatch = content.match(/;(?=\s*(?:stroke|width|fill|alpha)\s*=)/i);
      if (propSplitMatch) {
        const splitIndex = content.indexOf(propSplitMatch[0]);
        exprPart = content.slice(0, splitIndex).trim();
        propsPart = content.slice(splitIndex + 1);
      } else {
        exprPart = content;
        propsPart = '';
      }
      obj.expression = exprPart;
      propsPart.split(/;(?=\s*(?:stroke|width|fill|alpha)\s*=)/i).map(s => s.trim()).filter(Boolean).forEach(pair => {
        const [keyRaw, valRaw] = pair.split('=').map(s => s.trim());
        const key = keyRaw.toLowerCase();
        if (!allowedProps.has(key)) obj.errors.push(`Unknown key: ${key}`);
        else obj[key] = valRaw;
      });
      if (!obj.stroke) obj.errors.push('Missing stroke');
      if (!obj.width) obj.errors.push('Missing width');
      if (obj.stroke && !/^#([0-9a-fA-F]{6})$/.test(obj.stroke)) obj.errors.push('Bad stroke hex');
      if (obj.fill && !/^#([0-9a-fA-F]{6})$/.test(obj.fill)) obj.errors.push('Bad fill hex');
      if (obj.width && (isNaN(obj.width) || +obj.width <= 0)) obj.errors.push('Bad width');
      if (obj.alpha && (isNaN(obj.alpha) || +obj.alpha < 0 || +obj.alpha > 1)) obj.errors.push('Bad alpha');
      blocks.push(obj);
    }
    return blocks;
  }

  // MARK: Hex → RGBA conversion

  function rgba (hex = '#000000', a = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // MARK: Drawing helpers (grid, objects)

  function drawGrid () {
    // Draw axes and numeric labels to ±1000 world units
    const axisLen = 1000;
    const unitScale = 50;
    const len = axisLen * unitScale;
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(0, len);
    ctx.moveTo(-len, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.fillStyle      = '#000';
    ctx.font           = `${12 / camera.zoom}px sans-serif`;
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'top';
    for (let x = -axisLen; x <= axisLen; x++) {
      if (x === 0) continue;
      ctx.fillText(x.toString(), x * unitScale, 2 / camera.zoom);
    }
    ctx.textAlign      = 'right';
    ctx.textBaseline   = 'middle';
    for (let y = -axisLen; y <= axisLen; y++) {
      if (y === 0) continue;
      ctx.fillText((-y).toString(), -2 / camera.zoom, y * unitScale);
    }
    ctx.restore();
  }

  function renderObject (o) {
    const stroke  = rgba(o.stroke, o.alpha !== undefined ? +o.alpha : 1);
    const width   = +o.width || 1;
    const fillClr = o.fill ? rgba(o.fill, o.alpha !== undefined ? +o.alpha : 1) : null;

    ctx.lineWidth   = width / camera.zoom;
    ctx.strokeStyle = stroke;

    const path = new Path2D();
    const polyMatch = o.expression.match(/^poly\((.*)\)$/i);
    if (polyMatch) {
      const unit = 50;
      const nums = polyMatch[1].split(',').map(s => +s.trim());
      if (nums.length % 2 === 0) {
        for (let i = 0; i < nums.length; i += 2) {
          const x = nums[i] * unit;
          const y = -nums[i + 1] * unit;
          i === 0 ? path.moveTo(x, y) : path.lineTo(x, y);
        }
        path.closePath();
        if (fillClr) { ctx.fillStyle = fillClr; ctx.fill(path); }
        ctx.stroke(path);
        return;
      }
    }
    try {
      if (o.expression.includes('|')) {
        const [xEq, yEq] = o.expression.split('|').map(s => s.trim());
        const xFunc = math.compile(xEq.replace(/^x\(t\)\s*=\s*/, ''));
        const yFunc = math.compile(yEq.replace(/^y\(t\)\s*=\s*/, ''));

        const steps = 400, t0 = -Math.PI * 2, t1 = Math.PI * 2;
        for (let i = 0; i <= steps; i++) {
          const t = t0 + (t1 - t0) * i / steps;
          const x = xFunc.evaluate({ t }) * 50;
          const y = -yFunc.evaluate({ t }) * 50;
          i ? path.lineTo(x, y) : path.moveTo(x, y);
        }
      } else {
        const [, rhs] = o.expression.split('=');
        const yFunc   = math.compile(rhs.trim());
        const steps   = 400, x0 = -10, x1 = 10;
        for (let i = 0; i <= steps; i++) {
          const x = x0 + (x1 - x0) * i / steps;
          const y = yFunc.evaluate({ x }) * 50;
          const cx = x * 50;
          const cy = -y;
          i ? path.lineTo(cx, cy) : path.moveTo(cx, cy);
        }
      }
    } catch (err) {
      console.error(err);
      return;
    }

    if (fillClr) {
      ctx.fillStyle = fillClr;
      ctx.fill(path);
    }
    ctx.stroke(path);
  }

  // MARK: Main draw routine

  function draw () {
    ctx.save();
    ctx.resetTransform();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2 + camera.panX * camera.zoom,
                  canvas.height / 2 + camera.panY * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);

    if (gridToggle.checked) drawGrid();

    const parsed = parseLines(textarea.value);
    // Check parse errors and display reason
    const errorObj = parsed.find(o => o.errors && o.errors.length > 0);
    if (errorObj) {
      errorIndicator.textContent = `ERROR: ${errorObj.errors[0]}`;
    } else {
      errorIndicator.textContent = '';
    }
    parsed.filter(o => !(o.errors && o.errors.length > 0)).forEach(renderObject);

    ctx.restore();
  }

  // MARK: UI interactions

  textarea.addEventListener('input', draw);
  gridToggle.addEventListener('change', draw);

  resetBtn.addEventListener('click', () => {
    camera.panX = camera.panY = 0;
    camera.zoom = 1;
    zoomSlider.value = 1;
    draw();
  });

  exportBtn.addEventListener('click', () => {
    const origHeight = textarea.style.height;
    const origOverflow = textarea.style.overflow;
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.style.overflow = 'visible';
    overlay.style.display = 'none';
    const clone = document.createElement('div');
    const taStyle = getComputedStyle(textarea);
    clone.style.position = 'absolute';
    clone.style.top = textarea.offsetTop + 'px';
    clone.style.left = textarea.offsetLeft + 'px';
    clone.style.width = textarea.clientWidth + 'px';
    clone.style.height = textarea.scrollHeight + 'px';
    clone.style.fontFamily = taStyle.fontFamily;
    clone.style.fontSize = taStyle.fontSize;
    clone.style.whiteSpace = 'pre-wrap';
    clone.style.padding = taStyle.padding;
    clone.style.background = taStyle.background;
    clone.textContent = textarea.value;
    inputPane.appendChild(clone);
    textarea.style.visibility = 'hidden';
    html2canvas(document.getElementById('split-container')).then(exportCanvas => {
      const link = document.createElement('a');
      link.download = 'visualizer.png';
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      overlay.style.display = '';
      textarea.style.visibility = '';
      inputPane.removeChild(clone);
      textarea.style.height = origHeight;
      textarea.style.overflow = origOverflow;
    });
  });
    // MARK: Initial draw
  draw();
});
