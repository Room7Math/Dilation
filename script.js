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
    let hasDilated = false;
    let showTransformationHistory = false; // Default to hidden

    // Save state for undo
    function saveState() {
        history.push(JSON.parse(JSON.stringify(points)));
        if (history.length > 20) history.shift();
    }

    // Generic transformation function
    function applyTransformation(transformFn, logMessage) {
        saveState();
        const center = getCenterOfRotation();
        points.forEach((point, i) => {
            points[i] = transformFn(point, center);
        });
        transformationLog.push(logMessage);
        updateLog();
        updateDisplay();
    }

    // Parse fractional input
    function parseFraction(input) {
        if (!input) return 1;
        const fractionMatch = input.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/);
        if (fractionMatch) {
            const numerator = parseFloat(fractionMatch[1]);
            const denominator = parseFloat(fractionMatch[2]);
            if (denominator === 0) {
                alert('Denominator cannot be zero.');
                return 1;
            }
            return numerator / denominator;
        }
        const number = parseFloat(input);
        if (isNaN(number) || number === 0) {
            alert('Please enter a valid non-zero number or fraction (e.g., 3/2).');
            return 1;
        }
        return number;
    }

    // Helper functions
    function getScaleFactors() {
        const xScaleFactor = parseFraction(document.getElementsByName('xScaleFactor')[0].value.trim());
        const yScaleFactor = parseFraction(document.getElementsByName('yScaleFactor')[0].value.trim());
        return { xScale: xScaleFactor, yScale: yScaleFactor };
    }

    function getCenterOfRotation() {
        const xCenter = parseFloat(document.getElementsByName('xCoord')[0].value);
        const yCenter = parseFloat(document.getElementsByName('yCoord')[0].value);
        if (isNaN(xCenter) || isNaN(yCenter)) {
            alert('Please enter valid numbers for center of dilation.');
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

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasSize, y);
            ctx.stroke();

            if (i !== 0 && i % 2 === 0) {
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(i, center + i * gridSize, center + 5);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(i, center + 5, center - i * gridSize);
            }
        }

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

    function drawRays(displayPoints) {
        if (displayPoints.length < 1 || !hasDilated) return;
        const center = getCenterOfRotation();
        const centerCoord = getCanvasCoordinates(center.x, center.y);
        ctx.strokeStyle = 'rgba(0, 128, 0, 0.5)';
        ctx.lineWidth = 1;
        displayPoints.forEach(point => {
            const coord = getCanvasCoordinates(point.x, point.y);
            ctx.beginPath();
            ctx.moveTo(centerCoord.x, centerCoord.y);
            ctx.lineTo(coord.x, coord.y);
            ctx.stroke();
        });
    }

    function drawLines(displayPoints, isOriginal = false) {
        if (displayPoints.length < 1) return;

        const labeledPoints = new Set();
        let charCode = 65;
        ctx.strokeStyle = isOriginal ? 'gray' : 'blue';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const start = getCanvasCoordinates(displayPoints[0].x, displayPoints[0].y);
        ctx.moveTo(start.x, start.y);
        if (!isOriginal) {
            ctx.fillStyle = 'white';
            ctx.fillRect(start.x + 8, start.y + 2, 15, 15);
            ctx.fillStyle = 'black';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(String.fromCharCode(charCode), start.x + 10, start.y);
            labeledPoints.add(`${displayPoints[0].x},${displayPoints[0].y}`);
            charCode++;
        }

        for (let i = 1; i < displayPoints.length; i++) {
            const coord = getCanvasCoordinates(displayPoints[i].x, displayPoints[i].y);
            ctx.lineTo(coord.x, coord.y);
            const pointKey = `${displayPoints[i].x},${displayPoints[i].y}`;
            if (!isOriginal && !labeledPoints.has(pointKey)) {
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
        ctx.fillStyle = isOriginal ? 'lightcoral' : 'red';
        displayPoints.forEach(point => {
            const coord = getCanvasCoordinates(point.x, point.y);
            ctx.beginPath();
            ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function updateDisplay() {
        const formattedCoords = points.length > 0 ? getFormattedCoordinates(points) : 'None';
        document.getElementById('output').textContent = `Coordinates: ${formattedCoords}`;
        drawGrid();
        drawCenterPoint();
        if (hasDilated && history.length > 0) {
            drawLines(JSON.parse(JSON.stringify(history[history.length - 1])), true);
        }
        drawRays(points);
        drawLines(points);
    }

    function updateLog() {
        const logText = transformationLog.length > 0 ? transformationLog.join(', ') : 'None';
        const logElement = document.getElementById('transformationLog');
        logElement.textContent = `Transformation History: ${logText}`;
        logElement.style.display = showTransformationHistory ? 'block' : 'none';
        document.getElementById('toggleHistory').textContent = showTransformationHistory ? 'Hide Transformation History' : 'Show Transformation History';
    }

    function toggleDilationView() {
        // No-op since original is always visible
    }

    function dilate() {
        const { xScale, yScale } = getScaleFactors();
        if (xScale === 1 && yScale === 1 && (document.getElementsByName('xScaleFactor')[0].value !== '' || document.getElementsByName('yScaleFactor')[0].value !== '')) {
            return;
        }
        hasDilated = true;
        document.getElementById('toggleDilationView').disabled = true;
        applyTransformation((point, center) => {
            const translatedX = point.x - center.x;
            const translatedY = point.y - center.y;
            return {
                x: center.x + xScale * translatedX,
                y: center.y + yScale * translatedY
            };
        }, `Dilated by x-scale ${document.getElementsByName('xScaleFactor')[0].value || xScale}, y-scale ${document.getElementsByName('yScaleFactor')[0].value || yScale}`);
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

        updateDisplay();

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

    document.getElementById('dilate').addEventListener('click', dilate);
    document.getElementById('undo').addEventListener('click', () => {
        if (history.length > 0) {
            points.length = 0;
            points.push(...history.pop());
            hasDilated = history.length > 0;
            document.getElementById('toggleDilationView').disabled = true;
            transformationLog.push('Undo');
            updateLog();
            updateDisplay();
        }
    });
    document.getElementById('clearAll').addEventListener('click', () => {
        points.length = 0;
        transformationLog.length = 0;
        hasDilated = false;
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
            hasDilated = false;
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
        updateLog();
    });

    // Initial setup
    canvas.width = 700;
    canvas.height = 700;
    updateDisplay();
});