 
const baseCanvas = document.getElementById('baseCanvas');
const baseCtx = baseCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const ctx = drawingCanvas.getContext('2d');

let drawing = false;
let currentTool = 'pen';
let currentColor = '#000000';
let brushSize = 5;
let regionMask = null;  

const regionTolerance = 20;  

 
const baseImage = new Image();
baseImage.src = 'img/a.png';
baseImage.onload = function () {
  baseCtx.drawImage(baseImage, 0, 0, baseCanvas.width, baseCanvas.height);

};

function computeRegionMask(startX, startY) {
  const imageData = baseCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const mask = new Uint8Array(width * height);  
  const stack = [];
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const startIdx = (sy * width + sx) * 4;
  const startColor = {
    r: data[startIdx],
    g: data[startIdx + 1],
    b: data[startIdx + 2],
    a: data[startIdx + 3],
  };

  stack.push({ x: sx, y: sy });

  while (stack.length > 0) {
    const { x, y } = stack.pop();
    const pos = y * width + x;

    if (mask[pos]) continue;  

    const currentColor = getColorAt(x, y, data, width);
    if (matchColor(currentColor, startColor)) {
      mask[pos] = 1;  

       
      if (x > 0) stack.push({ x: x - 1, y });
      if (x < width - 1) stack.push({ x: x + 1, y });
      if (y > 0) stack.push({ x, y: y - 1 });
      if (y < height - 1) stack.push({ x, y: y + 1 });
    }
  }

  return mask;
}

 
document.getElementById('pen').addEventListener('click', () => {
  currentTool = 'pen';
  drawingCanvas.style.cursor = 'crosshair';
});

document.getElementById('fill').addEventListener('click', () => {
  currentTool = 'fill';
  drawingCanvas.style.cursor = 'pointer';
});

document.getElementById('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
});

document.getElementById('brushSize').addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value, 10);
});

 
document.querySelectorAll('.color-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentColor = btn.getAttribute('data-color');
  });
});

 
drawingCanvas.addEventListener('mousedown', (e) => {
  ctx.lastX = e.offsetX;
  ctx.lastY = e.offsetY;
  if (currentTool === 'pen') {
    regionMask = computeRegionMask(e.offsetX, e.offsetY);  
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  } else if (currentTool === 'fill') {
    const fillData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    floodFill(e.offsetX, e.offsetY, fillData, drawingCanvas.width, hexToRgb(currentColor));
    ctx.putImageData(fillData, 0, 0);  
  }
});

 
function computeBrushPixels(brushSize) {
  const radius = Math.floor(brushSize / 2);
  const brushPixels = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy <= radius * radius) {
         
        brushPixels.push([dx, dy]);
      }
    }
  }

  return brushPixels;
}

 
let brushPixelsCache = {};

drawingCanvas.addEventListener('mousemove', (e) => {
  if (drawing && currentTool === 'pen') {
    const x = Math.floor(e.offsetX);
    const y = Math.floor(e.offsetY);

     
    const previousX = Math.floor(ctx.lastX || x);
    const previousY = Math.floor(ctx.lastY || y);

     
    const points = discretizeLine(previousX, previousY, x, y);

     
    for (const [px, py] of points) {
       
      if (!brushPixelsCache[brushSize]) {
        brushPixelsCache[brushSize] = computeBrushPixels(brushSize);
      }
      const brushPixels = brushPixelsCache[brushSize];

       
      for (const [dx, dy] of brushPixels) {
        const bx = px + dx;
        const by = py + dy;

         
        if (bx < 0 || bx >= drawingCanvas.width || by < 0 || by >= drawingCanvas.height) {
          continue;  
        }

        const index = by * drawingCanvas.width + bx;
        if (regionMask && regionMask[index]) {
           
          ctx.fillStyle = currentColor;
          ctx.fillRect(bx, by, 1, 1);
        }
      }
    }

    ctx.lastX = x;
    ctx.lastY = y;
  }
});

 
function discretizeLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    points.push([x, y]);

    if (x === x1 && y === y1)
      break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

drawingCanvas.addEventListener('mouseup', () => {
  drawing = false;
});

drawingCanvas.addEventListener('mouseleave', () => {
  drawing = false;
});

 
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  let num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: 255,
  };
}

function getColorAt(x, y, data, width) {
  const pos = (y * width + x) * 4;
  return {
    r: data[pos],
    g: data[pos + 1],
    b: data[pos + 2],
    a: data[pos + 3],
  };
}

function setColorAt(x, y, data, width, color) {
  const pos = (y * width + x) * 4;
  data[pos] = color.r;
  data[pos + 1] = color.g;
  data[pos + 2] = color.b;
  data[pos + 3] = color.a;
}

function matchColor(c1, c2, tol = regionTolerance) {
  return (
    Math.abs(c1.r - c2.r) <= tol &&
    Math.abs(c1.g - c2.g) <= tol &&
    Math.abs(c1.b - c2.b) <= tol &&
    Math.abs(c1.a - c2.a) <= tol
  );
}

 
function floodFill(x, y, imageData, width, fillColor) {
  const height = imageData.height;
  const data = imageData.data;
  const visited = new Set();
  const stack = [[x, y]];
  const startColor = getColorAt(x, y, data, width);

  while (stack.length > 0) {
    const [currentX, currentY] = stack.pop();
    const index = (currentY * width + currentX) * 4;
    const key = `${currentX},${currentY}`;

    if (visited.has(key)) continue;

    const currentColor = getColorAt(currentX, currentY, data, width);
    if (!matchColor(currentColor, startColor)) continue;

    visited.add(key);
     

    if (currentX > 0) stack.push([currentX - 1, currentY]);
    if (currentX < width - 1) stack.push([currentX + 1, currentY]);
    if (currentY > 0) stack.push([currentX, currentY - 1]);
    if (currentY < height - 1) stack.push([currentX, currentY + 1]);
  }
}
