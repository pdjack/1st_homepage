/**
 * ZENITH - Memo & Calendar App
 * Pure Vanilla JS State Management & UI Rendering
 */

// --- State ---
let state = {
    currentMode: 'calendar', // 'calendar' or 'canvas'
    currentDate: new Date(),
    selectedDate: null,
    calendarData: {}, // { '2026-03-10': [{ id, text, completed, indexId }] }
    canvasData: [],   // [{ id, text, x, y, locked }]
    connections: [],  // [{ id, fromId, toId, fromPort, toPort }]
    indices: [],      // [{ id, name, color }]
    settings: {
        hasSeenOnboarding: false
    }
};

// --- Selectors ---
const onboardingOverlay = document.getElementById('onboarding-overlay');
const btnCloseOnboarding = document.getElementById('close-onboarding');

const btnCalendar = document.getElementById('btn-calendar');
const btnCanvas = document.getElementById('btn-canvas');
const calendarView = document.getElementById('calendar-view');
const canvasView = document.getElementById('canvas-view');

const calendarDays = document.getElementById('calendar-days');
const currentMonthYear = document.getElementById('current-month-year');
const btnPrevMonth = document.getElementById('prev-month');
const btnNextMonth = document.getElementById('next-month');

const checklistPanel = document.getElementById('checklist-panel');
const btnClosePanel = document.getElementById('close-panel');
const selectedDateTitle = document.getElementById('selected-date-title');
const todoList = document.getElementById('todo-list');
const newTodoInput = document.getElementById('new-todo-input');
const btnAddTodo = document.getElementById('add-todo-btn');

const canvasContainer = document.getElementById('canvas-container');
const saveStatus = document.getElementById('save-status');

const indexManagerOverlay = document.getElementById('index-manager-overlay');
const btnCloseIndexManager = document.getElementById('close-index-manager');
const btnManageIndices = document.getElementById('btn-manage-indices');
const newIndexName = document.getElementById('new-index-name');
const newIndexColor = document.getElementById('new-index-color');
const btnAddIndex = document.getElementById('btn-add-index');
const indexList = document.getElementById('index-list');
const todoIndexSelect = document.getElementById('todo-index-select');

// Canva Specific Selectors
const canvasSvg = document.getElementById('canvas-svg');
const memoContextMenu = document.getElementById('memo-context-menu');
const memoPorts = document.getElementById('memo-ports');
const btnMemoConnect = document.getElementById('btn-memo-connect');
const btnMemoLock = document.getElementById('btn-memo-lock');
const btnMemoDuplicate = document.getElementById('btn-memo-duplicate');
const btnMemoDelete = document.getElementById('btn-memo-delete');

// Canvas Interaction State
let selectedMemoId = null;
let isDrawingConnection = false;
let connectionStart = null; // { memoId, port }
let tempConnectionLine = null;
let isResizing = false;
let resizeDirection = null;
let resizeStart = null;
const memoColorPicker = document.getElementById('memo-color-picker');

// --- Initialization ---
function init() {
    loadFromLocalStorage();
    
    if (!state.indices) {
        state.indices = [];
    }
    if (!state.connections) {
        state.connections = [];
    }
    
    if (state.settings.hasSeenOnboarding) {
        onboardingOverlay.classList.add('hidden');
    }

    renderIndices();
    updateTodoIndexSelect();
    renderCalendar();
    renderCanvas();
    updateSaveStatus('Synced');
    
    attachEventListeners();
}

// --- Storage Logic ---
function saveToLocalStorage() {
    localStorage.setItem('zenith_data', JSON.stringify(state));
    updateSaveStatus('Saved');
    setTimeout(() => updateSaveStatus('Synced'), 2000);
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('zenith_data');
    if (data) {
        state = JSON.parse(data);
        // Date objects need re-parsing
        state.currentDate = new Date();
    }
}

function updateSaveStatus(text) {
    saveStatus.textContent = text;
}

// --- Event Listeners ---
function attachEventListeners() {
    // Mode Switching
    btnCalendar.addEventListener('click', () => switchMode('calendar'));
    btnCanvas.addEventListener('click', () => switchMode('canvas'));

    // Onboarding
    btnCloseOnboarding.addEventListener('click', () => {
        state.settings.hasSeenOnboarding = true;
        onboardingOverlay.classList.add('hidden');
        saveToLocalStorage();
    });

    // Index Manager Events
    btnManageIndices.addEventListener('click', () => {
        indexManagerOverlay.classList.remove('hidden');
    });
    btnCloseIndexManager.addEventListener('click', () => {
        indexManagerOverlay.classList.add('hidden');
    });
    btnAddIndex.addEventListener('click', addIndex);
    newIndexName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIndex();
    });

    // Calendar Navigation
    btnPrevMonth.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
    });
    btnNextMonth.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Panel Closing
    btnClosePanel.addEventListener('click', () => {
        checklistPanel.classList.remove('active');
    });

    // Checklist Adding
    btnAddTodo.addEventListener('click', addTodo);
    newTodoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    // Canvas double click to create
    canvasBoard.addEventListener('dblclick', (e) => {
        if (e.target === canvasBoard) {
            createMemo(e.offsetX, e.offsetY);
        }
    });
}

// Ensure variable is defined for the listener above
const canvasBoard = document.getElementById('canvas-container');

// --- Index Logic ---
function renderIndices() {
    indexList.innerHTML = '';
    state.indices.forEach((idx, i) => {
        const li = document.createElement('li');
        li.className = 'index-item';
        li.style.borderLeftColor = idx.color;
        li.innerHTML = `
            <span>${idx.name}</span>
            <button class="delete-index-btn">×</button>
        `;
        li.querySelector('.delete-index-btn').addEventListener('click', () => deleteIndex(i));
        indexList.appendChild(li);
    });
}

function updateTodoIndexSelect() {
    todoIndexSelect.innerHTML = '<option value="">No Index</option>';
    state.indices.forEach(idx => {
        const option = document.createElement('option');
        option.value = idx.id;
        option.textContent = idx.name;
        // Optionally map color for styling if desired, but default option styling is limited
        todoIndexSelect.appendChild(option);
    });
}

function addIndex() {
    const name = newIndexName.value.trim();
    const color = newIndexColor.value;
    if (!name) return;
    
    state.indices.push({
        id: Date.now(),
        name: name,
        color: color
    });
    
    newIndexName.value = '';
    renderIndices();
    updateTodoIndexSelect();
    renderCalendar();
    saveToLocalStorage();
}

function deleteIndex(index) {
    const indexId = state.indices[index].id;
    state.indices.splice(index, 1);
    
    // Remove index from tasks across all dates
    Object.values(state.calendarData).forEach(tasks => {
        tasks.forEach(task => {
            if (task.indexId === indexId) {
                delete task.indexId;
            }
        });
    });
    
    renderIndices();
    updateTodoIndexSelect();
    // Re-render checklist if it's currently open
    renderTodos(); 
    renderCalendar();
    saveToLocalStorage();
}

// --- UI Rendering - Modes ---
function switchMode(mode) {
    state.currentMode = mode;
    
    if (mode === 'calendar') {
        btnCalendar.classList.add('active');
        btnCanvas.classList.remove('active');
        calendarView.classList.remove('hidden');
        canvasView.classList.add('hidden');
        checklistPanel.classList.remove('active');
    } else {
        btnCanvas.classList.add('active');
        btnCalendar.classList.remove('active');
        canvasView.classList.remove('hidden');
        calendarView.classList.add('hidden');
        checklistPanel.classList.remove('active');
    }
}

// --- UI Rendering - Calendar ---
function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    currentMonthYear.textContent = `${monthNames[month]} ${year}`;
    
    calendarDays.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        calendarDays.appendChild(emptyDiv);
    }
    
    const today = new Date();

    for (let d = 1; d <= daysInMonth; d++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d) {
            dayDiv.classList.add('today');
        }
        
        const dayTasks = state.calendarData[dateStr] || [];
        const taskCount = dayTasks.length;
        const completedCount = dayTasks.filter(t => t.completed).length;

        // Group by indices
        const indexCounts = {};
        dayTasks.forEach(t => {
            if (t.indexId) {
                indexCounts[t.indexId] = (indexCounts[t.indexId] || 0) + 1;
            }
        });

        let indicesHtml = '';
        if (Object.keys(indexCounts).length > 0) {
            indicesHtml = '<div class="day-indices">';
            Object.entries(indexCounts).forEach(([idStr, count]) => {
                const idxObj = state.indices.find(idx => idx.id === Number(idStr));
                if (idxObj) {
                    indicesHtml += `
                        <div class="index-dot-container" title="${idxObj.name}: ${count}">
                            <div class="index-dot" style="background-color: ${idxObj.color};"></div>
                            <span>${count}</span>
                        </div>
                    `;
                }
            });
            indicesHtml += '</div>';
        }

        dayDiv.innerHTML = `
            <span class="day-number">${d}</span>
            <div class="day-preview">
                ${taskCount > 0 ? `${completedCount}/${taskCount} tasks` : ''}
                ${indicesHtml}
            </div>
        `;
        
        dayDiv.addEventListener('click', () => openChecklist(dateStr));
        calendarDays.appendChild(dayDiv);
    }
}

// --- UI Rendering - Checklist ---
function openChecklist(dateStr) {
    state.selectedDate = dateStr;
    const dateObj = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateTitle.textContent = dateObj.toLocaleDateString('en-US', options);
    
    checklistPanel.classList.add('active');
    renderTodos();
}

function renderTodos() {
    todoList.innerHTML = '';
    const items = state.calendarData[state.selectedDate] || [];
    
    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${item.completed ? 'completed' : ''}`;
        
        let indexBadgeHtml = '';
        if (item.indexId) {
            const idxObj = state.indices.find(idx => idx.id === item.indexId);
            if (idxObj) {
                indexBadgeHtml = `<div class="todo-item-index" style="background-color: ${idxObj.color};" title="${idxObj.name}"></div>`;
            }
        }

        li.innerHTML = `
            <div class="checkbox"></div>
            ${indexBadgeHtml}
            <span style="flex:1;">${item.text}</span>
            <button class="delete-task">Delete</button>
        `;
        
        li.querySelector('.checkbox').addEventListener('click', () => toggleTodo(index));
        li.querySelector('.delete-task').addEventListener('click', () => deleteTodo(index));
        
        todoList.appendChild(li);
    });
}

function addTodo() {
    const text = newTodoInput.value.trim();
    if (!text) return;
    
    if (!state.calendarData[state.selectedDate]) {
        state.calendarData[state.selectedDate] = [];
    }
    
    const selectedIndexId = todoIndexSelect.value ? Number(todoIndexSelect.value) : null;
    
    state.calendarData[state.selectedDate].push({
        id: Date.now(),
        text: text,
        completed: false,
        indexId: selectedIndexId
    });
    
    newTodoInput.value = '';
    renderTodos();
    renderCalendar();
    saveToLocalStorage();
}

function toggleTodo(index) {
    state.calendarData[state.selectedDate][index].completed = !state.calendarData[state.selectedDate][index].completed;
    renderTodos();
    renderCalendar();
    saveToLocalStorage();
}

function deleteTodo(index) {
    state.calendarData[state.selectedDate].splice(index, 1);
    renderTodos();
    renderCalendar();
    saveToLocalStorage();
}

// --- UI Rendering - Canvas ---
function renderCanvas() {
    // Keep SVG intact
    const memos = canvasContainer.querySelectorAll('.memo-box');
    memos.forEach(m => m.remove());
    
    state.canvasData.forEach(memo => {
        createMemoElement(memo);
    });
    renderLines();
}

function createMemo(x, y) {
    const memo = {
        id: Date.now(),
        text: '',
        x: x,
        y: y,
        width: 150,
        height: 100,
        color: '#121212',
        locked: false
    };
    state.canvasData.push(memo);
    createMemoElement(memo);
    saveToLocalStorage();
    selectMemo(memo.id);
    updateCanvasBounds();
}

function createMemoElement(memo) {
    const div = document.createElement('div');
    div.className = 'memo-box' + (memo.locked ? ' locked' : '') + (selectedMemoId === memo.id ? ' selected' : '');
    div.id = `memo-${memo.id}`;
    div.style.left = `${memo.x}px`;
    div.style.top = `${memo.y}px`;
    div.style.width = `${memo.width || 150}px`;
    div.style.height = `${memo.height || 100}px`;
    div.style.backgroundColor = memo.color || '#121212';
    
    // Resize handles
    ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-${pos}`;
        
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (memo.locked) return;
            isResizing = true;
            resizeDirection = pos;
            selectMemo(memo.id);
            resizeStart = { 
                x: e.clientX, y: e.clientY, 
                width: div.offsetWidth, height: div.offsetHeight,
                left: div.offsetLeft, top: div.offsetTop
            };
        });
        
        div.appendChild(handle);
    });
    
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Type something...';
    textarea.value = memo.text;
    if (memo.locked) textarea.readOnly = true;
    
    textarea.addEventListener('input', (e) => {
        memo.text = e.target.value;
        saveToLocalStorage();
    });
    
    // Selection and Drag logic
    let isDragging = false;
    let startX, startY;
    
    div.addEventListener('mousedown', (e) => {
        if (isDrawingConnection || isResizing) return;
        
        selectMemo(memo.id);
        
        if (memo.locked || e.target !== div && !e.target.classList.contains('memo-box')) return;
        
        isDragging = true;
        startX = e.clientX - div.offsetLeft;
        startY = e.clientY - div.offsetTop;
        div.style.zIndex = 1000;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isResizing && selectedMemoId === memo.id) {
            handleResize(e, div, memo);
            updateContextMenuAndPorts();
            renderLines();
            return;
        }

        if (!isDragging) return;
        const newX = Math.max(0, e.clientX - startX);
        const newY = Math.max(0, e.clientY - startY);
        
        div.style.left = `${newX}px`;
        div.style.top = `${newY}px`;
        
        memo.x = newX;
        memo.y = newY;
        
        updateContextMenuAndPorts();
        renderLines();
        updateCanvasBounds();
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            div.style.zIndex = '';
            saveToLocalStorage();
        }
        if (isResizing) {
            isResizing = false;
            resizeDirection = null;
            saveToLocalStorage();
            updateCanvasBounds();
        }
    });
    
    div.appendChild(textarea);
    canvasContainer.appendChild(div);
}

// --- Canvas Interactions ---
function selectMemo(id) {
    selectedMemoId = id;
    document.querySelectorAll('.memo-box').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`memo-${id}`);
    if (el) el.classList.add('selected');
    updateContextMenuAndPorts();
}

function deselectMemo() {
    selectedMemoId = null;
    document.querySelectorAll('.memo-box').forEach(el => el.classList.remove('selected'));
    memoContextMenu.classList.add('hidden');
    memoPorts.classList.add('hidden');
}

function updateContextMenuAndPorts() {
    if (!selectedMemoId) return;
    const memoEl = document.getElementById(`memo-${selectedMemoId}`);
    if (!memoEl) return;
    
    const rect = memoEl.getBoundingClientRect();
    const containerRect = canvasContainer.getBoundingClientRect();
    
    const top = rect.top - containerRect.top + canvasContainer.scrollTop;
    const left = rect.left - containerRect.left + canvasContainer.scrollLeft;
    
    // Context Menu
    memoContextMenu.style.left = `${left + rect.width / 2}px`;
    memoContextMenu.style.top = `${top - 10}px`;
    memoContextMenu.classList.remove('hidden');
    
    const memoData = state.canvasData.find(m => m.id === selectedMemoId);
    btnMemoLock.textContent = memoData?.locked ? '🔓' : '🔒';
    if (memoData && memoData.color) {
        memoColorPicker.value = memoData.color;
    } else {
        memoColorPicker.value = '#121212';
    }
    
    // Ports
    memoPorts.style.left = `${left}px`;
    memoPorts.style.top = `${top}px`;
    memoPorts.style.width = `${rect.width}px`;
    memoPorts.style.height = `${rect.height}px`;
    memoPorts.classList.remove('hidden');
}

function deleteSelectedMemo() {
    if (!selectedMemoId) return;
    state.canvasData = state.canvasData.filter(m => m.id !== selectedMemoId);
    state.connections = state.connections.filter(c => c.fromId !== selectedMemoId && c.toId !== selectedMemoId);
    deselectMemo();
    renderCanvas();
    saveToLocalStorage();
}

function duplicateSelectedMemo() {
    if (!selectedMemoId) return;
    const memo = state.canvasData.find(m => m.id === selectedMemoId);
    if (!memo) return;
    
    createMemo(memo.x + 20, memo.y + 20);
    const newMemo = state.canvasData[state.canvasData.length - 1];
    newMemo.text = memo.text;
    newMemo.locked = memo.locked;
    
    renderCanvas();
    saveToLocalStorage();
    selectMemo(newMemo.id);
}

function toggleLockSelectedMemo() {
    if (!selectedMemoId) return;
    const memo = state.canvasData.find(m => m.id === selectedMemoId);
    if (!memo) return;
    memo.locked = !memo.locked;
    renderCanvas();
    saveToLocalStorage();
    selectMemo(selectedMemoId);
}

// --- Memo Resizing & Canvas Bounds ---
function handleResize(e, div, memo) {
    if (!resizeStart || !resizeDirection) return;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newLeft = resizeStart.left;
    let newTop = resizeStart.top;

    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;

    if (resizeDirection.includes('e')) newWidth += dx;
    if (resizeDirection.includes('s')) newHeight += dy;
    if (resizeDirection.includes('w')) {
        newWidth -= dx;
        newLeft += dx;
    }
    if (resizeDirection.includes('n')) {
        newHeight -= dy;
        newTop += dy;
    }

    // Min dimensions
    newWidth = Math.max(100, newWidth);
    newHeight = Math.max(60, newHeight);
    
    // Boundary check so we don't go negative
    newLeft = Math.max(0, newLeft);
    newTop = Math.max(0, newTop);

    div.style.width = `${newWidth}px`;
    div.style.height = `${newHeight}px`;
    div.style.left = `${newLeft}px`;
    div.style.top = `${newTop}px`;

    memo.width = newWidth;
    memo.height = newHeight;
    memo.x = newLeft;
    memo.y = newTop;
}

function updateCanvasBounds() {
    if (state.canvasData.length === 0) return;
    
    let maxX = 0;
    let maxY = 0;

    state.canvasData.forEach(m => {
        const rX = m.x + (m.width || 150) + 100; // 100px padding
        const rY = m.y + (m.height || 100) + 100;
        if (rX > maxX) maxX = rX;
        if (rY > maxY) maxY = rY;
    });

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    canvasBoard.style.width = `${Math.max(windowWidth, maxX)}px`;
    canvasBoard.style.height = `${Math.max(windowHeight, maxY)}px`;
    canvasSvg.style.width = `${Math.max(windowWidth, maxX)}px`;
    canvasSvg.style.height = `${Math.max(windowHeight, maxY)}px`;
}

// --- Connection Logic ---
function setupConnectionPorts() {
    memoPorts.querySelectorAll('.port-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (!selectedMemoId) return;
            isDrawingConnection = true;
            connectionStart = { memoId: selectedMemoId, port: btn.dataset.port };
            
            tempConnectionLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempConnectionLine.setAttribute('stroke', '#8B5CF6');
            tempConnectionLine.setAttribute('stroke-width', '2');
            tempConnectionLine.setAttribute('fill', 'none');
            tempConnectionLine.setAttribute('stroke-dasharray', '5,5');
            tempConnectionLine.style.zIndex = '1000';
            tempConnectionLine.style.pointerEvents = 'none';
            canvasSvg.appendChild(tempConnectionLine);
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDrawingConnection || !tempConnectionLine || !connectionStart) return;
        
        const startPos = getPortPosition(connectionStart.memoId, connectionStart.port);
        const containerRect = canvasContainer.getBoundingClientRect();
        
        const endX = e.clientX - containerRect.left + canvasContainer.scrollLeft;
        const endY = e.clientY - containerRect.top + canvasContainer.scrollTop;
        
        tempConnectionLine.setAttribute('d', createCurvedPath(startPos.x, startPos.y, endX, endY, connectionStart.port, 'top'));
    });
    
    document.addEventListener('mouseup', (e) => {
        if (!isDrawingConnection) return;
        isDrawingConnection = false;
        
        if (tempConnectionLine) {
            tempConnectionLine.remove();
            tempConnectionLine = null;
        }
        
        const target = e.target;
        let targetMemoId = null;
        let targetPort = 'top';
        
        if (target.classList.contains('port-btn')) {
            targetMemoId = selectedMemoId;
            targetPort = target.dataset.port;
        } else {
            const memoEl = target.closest('.memo-box');
            if (memoEl) {
                targetMemoId = Number(memoEl.id.split('-')[1]);
                const rect = memoEl.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                const relY = e.clientY - rect.top;
                
                if (relX < rect.width * 0.2) targetPort = 'left';
                else if (relX > rect.width * 0.8) targetPort = 'right';
                else if (relY > rect.height / 2) targetPort = 'bottom';
            }
        }
        
        if (targetMemoId && targetMemoId !== connectionStart.memoId) {
            state.connections.push({
                id: Date.now(),
                fromId: connectionStart.memoId,
                toId: targetMemoId,
                fromPort: connectionStart.port,
                toPort: targetPort
            });
            saveToLocalStorage();
            renderLines();
        }
        
        connectionStart = null;
    });
}

function getPortPosition(memoId, port) {
    const memo = state.canvasData.find(m => m.id === memoId);
    if (!memo) return { x: 0, y: 0 };
    
    const el = document.getElementById(`memo-${memo.id}`);
    if (!el) return { x: 0, y: 0 };
    
    const width = el.offsetWidth || 150;
    const height = el.offsetHeight || 100;
    
    let px = memo.x;
    let py = memo.y;
    
    if (port === 'top') { px += width / 2; py += 0; }
    else if (port === 'bottom') { px += width / 2; py += height; }
    else if (port === 'left') { px += 0; py += height / 2; }
    else if (port === 'right') { px += width; py += height / 2; }
    
    return { x: px, y: py };
}

function createCurvedPath(x1, y1, x2, y2, port1, port2) {
    let cp1x = x1, cp1y = y1;
    let cp2x = x2, cp2y = y2;
    const curveOffset = Math.abs(x2 - x1) / 2 + Math.abs(y2 - y1) / 2;
    const offset = Math.min(100, Math.max(30, curveOffset));
    
    if (port1 === 'top') cp1y -= offset;
    else if (port1 === 'bottom') cp1y += offset;
    else if (port1 === 'left') cp1x -= offset;
    else if (port1 === 'right') cp1x += offset;

    if (port2 === 'top') cp2y -= offset;
    else if (port2 === 'bottom') cp2y += offset;
    else if (port2 === 'left') cp2x -= offset;
    else if (port2 === 'right') cp2x += offset;
    
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function renderLines() {
    canvasSvg.innerHTML = '';
    
    state.connections.forEach(conn => {
        const fromPos = getPortPosition(conn.fromId, conn.fromPort);
        const toPos = getPortPosition(conn.toId, conn.toPort);
        
        if (fromPos.x === 0 && fromPos.y === 0) return;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createCurvedPath(fromPos.x, fromPos.y, toPos.x, toPos.y, conn.fromPort, conn.toPort));
        path.setAttribute('stroke', '#8B5CF6');
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        path.setAttribute('class', 'connection-line');
        path.style.cursor = 'pointer';
        path.style.pointerEvents = 'stroke';
        path.id = `conn-${conn.id}`;
        
        // Click to delete connection
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this connection?')) {
                state.connections = state.connections.filter(c => c.id !== conn.id);
                saveToLocalStorage();
                renderLines();
            }
        });
        
        canvasSvg.appendChild(path);
    });
}

// Initialization Additional Setup
canvasBoard.addEventListener('mousedown', (e) => {
    if (e.target === canvasBoard || e.target === canvasSvg) {
        deselectMemo();
    }
});

btnMemoDelete.addEventListener('click', deleteSelectedMemo);
btnMemoDuplicate.addEventListener('click', duplicateSelectedMemo);
btnMemoLock.addEventListener('click', toggleLockSelectedMemo);

memoColorPicker.addEventListener('input', (e) => {
    if (!selectedMemoId) return;
    const memo = state.canvasData.find(m => m.id === selectedMemoId);
    if (!memo) return;
    memo.color = e.target.value;
    const el = document.getElementById(`memo-${memo.id}`);
    if (el) el.style.backgroundColor = memo.color;
    saveToLocalStorage();
});

document.addEventListener('DOMContentLoaded', () => {
    setupConnectionPorts();
    updateCanvasBounds();
});

// --- Start ---
init();
