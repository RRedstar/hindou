// Récupération des canevas et contextes
const baseCanvas = document.getElementById('baseCanvas');
const baseCtx = baseCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const ctx = drawingCanvas.getContext('2d');

// Variables d'état
let drawing = false;
let currentTool = 'pen'; // "pen" pour pinceau, "fill" pour remplissage
let currentColor = '#000000';
let brushSize = 5;
let regionMask = null; // Masque de la région autorisée (Uint8Array)

// Tolérance pour la comparaison dans le masque (peut être ajustée)
const regionTolerance = 20;

// Chargement de l'image de base (format PNG recommandé)
const baseImage = new Image();
baseImage.src = 'img/6699.png'; // Vérifiez que le fichier est au bon endroit
baseImage.onload = function() {
  baseCtx.drawImage(baseImage, 0, 0, baseCanvas.width, baseCanvas.height);
};

// Gestion de la toolbar
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

// Sélection de couleur
document.querySelectorAll('.color-button').forEach(btn => {
  btn.addEventListener('click', () => {
    currentColor = btn.getAttribute('data-color');
  });
});

// Événements sur le canevas de dessin
drawingCanvas.addEventListener('mousedown', (e) => {
  if (currentTool === 'pen') {
    // Calcule la zone autorisée à partir du point cliqué
    regionMask = computeRegionMask(e.offsetX, e.offsetY);
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  } else if (currentTool === 'fill') {
    floodFill(e.offsetX, e.offsetY, hexToRgb(currentColor));
  }
});
drawingCanvas.addEventListener('mousemove', (e) => {
  if (drawing && currentTool === 'pen') {
    const x = Math.floor(e.offsetX);
    const y = Math.floor(e.offsetY);
    const index = y * drawingCanvas.width + x;
    // Débogage : Affiche dans la console la valeur du masque pour ce pixel
    // console.log("Mask à (", x, y, "):", regionMask ? regionMask[index] : 'pas de masque');
    if (regionMask && regionMask[index]) {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      // Hors de la zone : réinitialiser le tracé pour éviter les lignes traversantes
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    }
  }
});
drawingCanvas.addEventListener('mouseup', () => {
  drawing = false;
});
drawingCanvas.addEventListener('mouseleave', () => {
  drawing = false;
});

/* -------------------
   Fonctions Utilitaires
----------------------*/

// Conversion d'une couleur hexadécimale en objet RGB
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  let num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: 255
  };
}

// Renvoie la couleur du pixel (x, y) dans les données d'image
function getColorAt(x, y, data, width) {
  const pos = (y * width + x) * 4;
  return {
    r: data[pos],
    g: data[pos + 1],
    b: data[pos + 2],
    a: data[pos + 3]
  };
}

// Compare deux couleurs avec une tolérance (paramètre tol, ici regionTolerance)
function matchColor(c1, c2, tol = regionTolerance) {
  return (
    Math.abs(c1.r - c2.r) <= tol &&
    Math.abs(c1.g - c2.g) <= tol &&
    Math.abs(c1.b - c2.b) <= tol &&
    Math.abs(c1.a - c2.a) <= tol
  );
}

/* -------------------
   Calcul du masque de la région
----------------------*/

// Calcule le masque (Uint8Array) de la zone délimitée par le contour.
// Tous les pixels appartenant à la même région que le point de départ seront marqués 1.
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
    a: data[startIdx + 3]
  };

  stack.push({ x: sx, y: sy });
  while (stack.length > 0) {
    const { x, y } = stack.pop();
    const pos = y * width + x;
    if (mask[pos]) continue; // Déjà visité

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

/* -------------------
   Implémentation du flood fill pour le remplissage
----------------------*/

function floodFill(startX, startY, fillColor) {
  const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const stack = [];
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const startPos = (sy * width + sx) * 4;
  const startColor = {
    r: data[startPos],
    g: data[startPos + 1],
    b: data[startPos + 2],
    a: data[startPos + 3]
  };

  if (matchColor(startColor, fillColor)) return;
  stack.push({ x: sx, y: sy });

  while (stack.length > 0) {
    const { x, y } = stack.pop();
    let currentY = y;
    while (currentY >= 0 && matchColor(getColorAt(x, currentY, data, width), startColor)) {
      currentY--;
    }
    currentY++;
    let reachLeft = false;
    let reachRight = false;
    while (currentY < height && matchColor(getColorAt(x, currentY, data, width), startColor)) {
      setColorAt(x, currentY, data, width, fillColor);
      if (x > 0) {
        if (matchColor(getColorAt(x - 1, currentY, data, width), startColor)) {
          if (!reachLeft) {
            stack.push({ x: x - 1, y: currentY });
            reachLeft = true;
          }
        } else {
          reachLeft = false;
        }
      }
      if (x < width - 1) {
        if (matchColor(getColorAt(x + 1, currentY, data, width), startColor)) {
          if (!reachRight) {
            stack.push({ x: x + 1, y: currentY });
            reachRight = true;
          }
        } else {
          reachRight = false;
        }
      }
      currentY++;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function setColorAt(x, y, data, width, color) {
  const pos = (y * width + x) * 4;
  data[pos] = color.r;
  data[pos + 1] = color.g;
  data[pos + 2] = color.b;
  data[pos + 3] = color.a;
}
