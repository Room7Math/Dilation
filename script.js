document.addEventListener('DOMContentLoaded', () => {
const canvas = document.getElementById('gridCanvas');
const ctx = canvas.getContext('2d');
ctx.font = "10px Arial";
const gridSize = 20;
const range = 17;
const points = [];
const history = [];
const transformationLog = [];
const pointMaxCount = 26; // Points A-Z allowed
let isSettingCenter = false;
let reflectionLine = null; // Store reflection line parameters for rendering
let showTransformationHistory = false; // Track history display state
let showBeforeDilation = false; // Track whether to show pre-dilation state
let hasDilated = false; // Track if a dilation has occurred

// Save state for undo
function saveState() {
    history.push(JSON.parse(JSON.stringify(points)));
    if (history.length > 20) history.shift();
}

// Generic transformation function
function applyTransformation(transformFn, logMessage) {
    saveState(); // Save state before applying transformation
    const center = getCenterOfRotation();
    points.forEach((point, i) => {
        points[i] = transformFn(point, center);
    });
    transformationLog.push(logMessage);
    updateLog();
    updateDisplay();
}

// Helper functions
function getTranslationMoves() {
    const xMove = parseFloat(document.getElementsByName('xMove')[0].value);
    const yMove = parseFloat(document.getElementsByName('yMove')[0].value);
    if (isNaN(xMove) || isNaN(yMove)) {
        alert('Please enter valid numbers for translation.');
        return { x: 0, y: 0 };
    }
    return { x: xMove, y: yMove };
}

function getScaleFactors() {
    const xScaleFactor = parseFloat(document.getElementsByName('xScaleFactor')[0].value);
    const yScaleFactor = parseFloat(document.getElementsByName('yScaleFactor')[0].value);
    if (isNaN(xScaleFactor) || isNaN(yScaleFactor) || xScaleFactor === 0 || yScaleFactor === 0) {
        alert('Please enter valid non-zero scale factors for dilation.');
        return { xScale: 1, yScale: 1 }; // Default to no scaling
    }
    return { xScale: xScaleFactor, yScale: yScaleFactor };
}

function getCenterOfRotation() {
    const xCenter = parseFloat(document.getElementsByName('xCoord')[0].value);
    const yCenter = parseFloat(document.getElementsByName('yCoord')[0].value);
    if (isNaN(xCenter) || isNaN(yCenter)) {
        alert('Please enter valid numbers for center of dilation/rotation.');
        return { x: 0, y: 0 };
    }
    return { x: xCenter, y: yCenter };
}

function getFormattedCoordinates(points) {
    const uniquePoints = (points.length > 1 &&
        points[0].x === points[points.length - 1].x &&
        points[0].y === points[points.length - 1].y)
        ? points.slice(0, -1)
        : points;

    return uniquePoints.map((point, index) => {
        const label = String.fromCharCode(65 + index);
        return `${label} (${point.x}, ${point.y})`;
    }).join(', ');
}

function getGridCoordinates(x, y) {
    const canvasCenter = canvas.width / 2;
    const gridX = Math.round((x - canvasCenter) / gridSize);
    const gridY = Math.round((canvasCenter - y) / gridSize);
    return { x: gridX, y: gridY };
}

function getCanvasCoordinates(gridX, gridY) {
    const canvasCenter = canvas.width / 2;
    const canvasX = canvasCenter + gridX * gridSize;
    const canvasY = canvasCenter - gridY * gridSize;
    return { x: canvasX, y: canvasY };
}

function drawGrid() {
    const canvasSize = canvas.width;
    const center = canvasSize / 2;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    for (let i = -range; i <= range; i++) {
        const x = center + i * gridSize;
        const y = center - i * gridSize;

        // Draw grid lines
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize, y);
        ctx.stroke();

        // Draw axis labels every 2 units for clarity
        if (i !== 0 && i % 2 === 0) {
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(i, center + i * gridSize, center + 5); // X-axis labels below axis
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(i, center + 5, center - i * gridSize); // Y-axis labels to the right
        }
    }

    // Draw main axes
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, center);
    ctx.lineTo(canvasSize, center);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, canvasSize);
    ctx.stroke();
}

function drawCenterPoint() {
    const center = getCenterOfRotation();
    const coord = getCanvasCoordinates(center.x, center.y);
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawReflectionLine(m, b) {
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const start = getCanvasCoordinates(-range, m * -range + b);
    const end = getCanvasCoordinates(range, m * range + b);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

function drawLines(displayPoints) {
    if (displayPoints.length < 1) return;

    const labeledPoints = new Set();
    let charCode = 65;
    ctx.strokeStyle = showBeforeDilation ? 'gray' : 'blue'; // Gray for before, blue for after
    ctx.lineWidth = 2;
    ctx.beginPath();

    const start = getCanvasCoordinates(displayPoints[0].x, displayPoints[0].y);
    ctx.moveTo(start.x, start.y);
    ctx.fillStyle = 'white';
    ctx.fillRect(start.x + 8, start.y + 2, 15, 15);
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String.fromCharCode(charCode), start.x + 10, start.y);
    labeledPoints.add(`${displayPoints[0].x},${displayPoints[0].y}`);
    charCode++;

    for (let i = 1; i < displayPoints.length; i++) {
        const coord = getCanvasCoordinates(displayPoints[i].x, displayPoints[i].y);
        ctx.lineTo(coord.x, coord.y);
        const pointKey = `${displayPoints[i].x},${displayPoints[i].y}`;
        if (!labeledPoints.has(pointKey)) {
            ctx.fillStyle = 'white';
            ctx.fillRect(coord.x + 8, coord.y + 2, 15, 15);
            ctx.fillStyle = 'black';
            ctx.fillText(String.fromCharCode(charCode), coord.x + 10, coord.y);
            labeledPoints.add(pointKey);
            charCode++;
        }
    }

    if (displayPoints.length > 2 && displayPoints[0].x === displayPoints[displayPoints.length - 1].x && displayPoints[0].y === displayPoints[points.length - 1].y) {
        ctx.lineTo(start.x, start.y);
    }

    ctx.stroke();
    ctx.fillStyle = showBeforeDilation ? 'lightcoral' : 'red'; // Lightcoral for before, red for after
    displayPoints.forEach(point => {
        const coord = getCanvasCoordinates(point.x, point.y);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function updateDisplay() {
    // Select points to display: pre-dilation (from history) or post-dilation (current points)
    const displayPoints = showBeforeDilation && hasDilated && history.length > 0 ? 
        JSON.parse(JSON.stringify(history[history.length - 1])) : points;
    const formattedCoords = displayPoints.length > 0 ? getFormattedCoordinates(displayPoints) : 'None';
    document.getElementById('output').textContent = `Coordinates: ${formattedCoords}`;
    drawGrid();
    drawCenterPoint();
    if (reflectionLine && !showBeforeDilation) { // Only draw reflection line in "after" view
        drawReflectionLine(reflectionLine.m, reflectionLine.b);
    }
    drawLines(displayPoints);
}

function updateLog() {
    const logText = transformationLog.length > 0 ? transformationLog.join(', ') : 'None';
    const logElement = document.getElementById('transformationLog');
    if (showTransformationHistory) {
        logElement.textContent = `Transformation History: ${logText}`;
        logElement.style.display = 'block';
    } else {
        logElement.style.display = 'none';
    }
}

function toggleDilationView() {
    if (!hasDilated || history.length === 0) return;
    showBeforeDilation = !showBeforeDilation;
    document.getElementById('toggleDilationView').textContent = showBeforeDilation ? 'Show After Dilation' : 'Show Before Dilation';
    updateDisplay();
}

// Transformation functions
function translate() {
    const moves = getTranslationMoves();
    if (moves.x === 0 && moves.y === 0 && (document.getElementsByName('xMove')[0].value !== '' || document.getElementsByName('yMove')[0].value !== '')) {
        return;
    }
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point) => ({
        x: point.x + moves.x,
        y: point.y + moves.y
    }), `Translated by (${moves.x}, ${moves.y})`);
}

function dilate() {
    const { xScale, yScale } = getScaleFactors();
    if (xScale === 1 && yScale === 1 && (document.getElementsByName('xScaleFactor')[0].value !== '' || document.getElementsByName('yScaleFactor')[0].value !== '')) {
        return;
    }
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Show dilated view after dilation
    hasDilated = true; // Enable toggle button
    document.getElementById('toggleDilationView').disabled = false;
    applyTransformation((point, center) => {
        const translatedX = point.x - center.x;
        const translatedY = point.y - center.y;
        return {
            x: center.x + xScale * translatedX,
            y: center.y + yScale * translatedY
        };
    }, `Dilated by x-scale ${xScale}, y-scale ${yScale}`);
}

function reflectYAxis() {
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point) => ({
        x: -point.x,
        y: point.y
    }), 'Reflected over Y-axis');
}

function reflectXAxis() {
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point) => ({
        x: point.x,
        y: -point.y
    }), 'Reflected over X-axis');
}

function rotatePointsCCW() {
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point, center) => {
        const translatedX = point.x - center.x;
        const translatedY = point.y - center.y;
        return {
            x: -translatedY + center.x,
            y: translatedX + center.y
        };
    }, 'Rotated 90° CCW');
}

function rotatePointsCW() {
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point, center) => {
        const translatedX = point.x - center.x;
        const translatedY = point.y - center.y;
        return {
            x: translatedY + center.x,
            y: -translatedX + center.y
        };
    }, 'Rotated 90° CW');
}

function rotatePoints180() {
    reflectionLine = null; // Clear reflection line
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle after non-dilation transformation
    document.getElementById('toggleDilationView').disabled = true;
    applyTransformation((point, center) => {
        const translatedX = point.x - center.x;
        const translatedY = point.y - center.y;
        return {
            x: -translatedX + center.x,
            y: -translatedY + center.y
        };
    }, 'Rotated 180°');
}

function reflectAcrossLine() {
    const lineInput = document.getElementsByName('lineOfReflection')[0].value.trim();
    if (!lineInput) {
        alert('Please enter a line equation.');
        return;
    }

    const slopeInterceptMatch = lineInput.match(/^y\s*=\s*([\d.-]+)\s*\*\s*x\s*\+\s*([\d.-]+)$/);
    const verticalLineMatch = lineInput.match(/^x\s*=\s*([\d.-]+)$/);

    if (slopeInterceptMatch) {
        const m = parseFloat(slopeInterceptMatch[1]);
        const b = parseFloat(slopeInterceptMatch[2]);
        reflectionLine = { m, b }; // Store reflection line
        showBeforeDilation = false; // Reset dilation view
        hasDilated = false; // Disable toggle after non-dilation transformation
        document.getElementById('toggleDilationView').disabled = true;
        applyTransformation((point) => {
            const { x: x1, y: y1 } = point;
            const d = (x1 + (y1 - b) * m) / (1 + m ** 2);
            return { x: 2 * d - x1, y: 2 * d * m - y1 + 2 * b };
        }, `Reflected across y = ${m}x + ${b}`);
    } else if (verticalLineMatch) {
        const c = parseFloat(verticalLineMatch[1]);
        reflectionLine = null; // No line to draw for vertical
        showBeforeDilation = false; // Reset dilation view
        hasDilated = false; // Disable toggle after non-dilation transformation
        document.getElementById('toggleDilationView').disabled = true;
        applyTransformation((point) => ({
            x: 2 * c - point.x,
            y: point.y
        }), `Reflected across x = ${c}`);
    } else {
        alert('Please enter a valid line equation in the form y = m * x + b or x = c');
        return;
    }
}

// Event listeners
canvas.addEventListener('mouseleave', () => {
    updateDisplay();
});

canvas.addEventListener('mousemove', (event) => {
    if (points.length >= pointMaxCount || isSettingCenter) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const gridCoords = getGridCoordinates(canvasX, canvasY);
    const snappedCanvasCoords = getCanvasCoordinates(gridCoords.x, gridCoords.y);

    // Redraw the current state first
    updateDisplay();

    // Draw preview point on top
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(snappedCanvasCoords.x, snappedCanvasCoords.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'red';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`(${gridCoords.x}, ${gridCoords.y})`, snappedCanvasCoords.x + 10, snappedCanvasCoords.y);
    ctx.restore();
});

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const gridCoords = getGridCoordinates(canvasX, canvasY);

    if (isSettingCenter) {
        if (Number.isInteger(gridCoords.x) && Number.isInteger(gridCoords.y)) {
            document.getElementsByName('xCoord')[0].value = gridCoords.x;
            document.getElementsByName('yCoord')[0].value = gridCoords.y;
            isSettingCenter = false;
            document.getElementById('setCenterByClick').textContent = 'Set Center by Click';
            transformationLog.push(`Set center to (${gridCoords.x}, ${gridCoords.y})`);
            updateLog();
            updateDisplay();
        }
    } else if (
        points.length >= 2 &&
        points[0].x === gridCoords.x &&
        points[0].y === gridCoords.y &&
        points.length < pointMaxCount
    ) {
        saveState();
        points.push({ x: points[0].x, y: points[0].y });
        transformationLog.push(`Closed shape at Point A (${gridCoords.x}, ${gridCoords.y})`);
        updateLog();
        updateDisplay();
    } else if (
        points.length < pointMaxCount &&
        Number.isInteger(gridCoords.x) &&
        Number.isInteger(gridCoords.y) &&
        Math.abs(gridCoords.x) <= range &&
        Math.abs(gridCoords.y) <= range &&
        !points.some(p => p.x === gridCoords.x && p.y === gridCoords.y)
    ) {
        saveState();
        points.push(gridCoords);
        transformationLog.push(`Added point (${gridCoords.x}, ${gridCoords.y})`);
        updateLog();
        updateDisplay();
    }
});

document.getElementById('translate').addEventListener('click', translate);
document.getElementById('dilate').addEventListener('click', dilate);
document.getElementById('reflectYAxis').addEventListener('click', reflectYAxis);
document.getElementById('reflectXAxis').addEventListener('click', reflectXAxis);
document.getElementById('rotateCCWButton').addEventListener('click', rotatePointsCCW);
document.getElementById('rotateCWButton').addEventListener('click', rotatePointsCW);
document.getElementById('rotate180Button').addEventListener('click', rotatePoints180);
document.getElementById('reflection').addEventListener('click', reflectAcrossLine);
document.getElementById('undo').addEventListener('click', () => {
    if (history.length > 0) {
        points.length = 0;
        points.push(...history.pop());
        reflectionLine = null;
        showBeforeDilation = false; // Reset dilation view
        hasDilated = false; // Disable toggle after undo
        document.getElementById('toggleDilationView').disabled = true;
        transformationLog.push('Undo');
        updateLog();
        updateDisplay();
    }
});
document.getElementById('clearAll').addEventListener('click', () => {
    points.length = 0;
    reflectionLine = null;
    transformationLog.length = 0; // Clear history
    showBeforeDilation = false; // Reset dilation view
    hasDilated = false; // Disable toggle
    document.getElementById('toggleDilationView').disabled = true;
    updateLog();
    updateDisplay();
});
document.getElementById('saveShape').addEventListener('click', () => {
    localStorage.setItem('savedShape', JSON.stringify(points));
    alert('Shape saved!');
    transformationLog.push('Saved shape');
    updateLog();
});
document.getElementById('loadShape').addEventListener('click', () => {
    const saved = localStorage.getItem('savedShape');
    if (saved) {
        saveState();
        points.length = 0;
        points.push(...JSON.parse(saved));
        reflectionLine = null;
        showBeforeDilation = false; // Reset dilation view
        hasDilated = false; // Disable toggle
        document.getElementById('toggleDilationView').disabled = true;
        transformationLog.push('Loaded shape');
        updateLog();
        updateDisplay();
    } else {
        alert('No saved shape found.');
    }
});
document.getElementById('resetCenter').addEventListener('click', () => {
    document.getElementsByName('xCoord')[0].value = 0;
    document.getElementsByName('yCoord')[0].value = 0;
    transformationLog.push('Reset center to (0, 0)');
    updateLog();
    updateDisplay();
});
document.getElementById('setCenterByClick').addEventListener('click', () => {
    isSettingCenter = !isSettingCenter;
    document.getElementById('setCenterByClick').textContent = isSettingCenter ? 'Click to Set Center' : 'Set Center by Click';
    updateDisplay();
});
document.getElementById('toggleHistory').addEventListener('click', () => {
    showTransformationHistory = !showTransformationHistory;
    document.getElementById('toggleHistory').textContent = showTransformationHistory ? 'Show Transformation History':'Hide Transformation History' ;
    updateLog();
});
document.getElementById('toggleDilationView').addEventListener('click', toggleDilationView);

// Initial setup
canvas.width = 700;
canvas.height = 700;
updateDisplay();
});