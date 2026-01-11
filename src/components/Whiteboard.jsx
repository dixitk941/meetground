import { useCallback, useEffect, useState, useRef } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  Pencil,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Diamond,
  Download,
  Save,
  Trash2,
  Undo,
  Redo,
  Move,
  MousePointer,
  Palette,
  Plus,
  X,
  Check,
} from 'lucide-react';

const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  LINE: 'line',
  ARROW: 'arrow',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  DIAMOND: 'diamond',
  TEXT: 'text',
  ERASER: 'eraser',
  PAN: 'pan',
};

const COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#F43F5E', '#84CC16', '#06B6D4',
];

const STROKE_WIDTHS = [2, 4, 6, 8, 12];

const Whiteboard = () => {
  const { whiteboardData, updateWhiteboard, isAdmin, meetingId } = useMeeting();
  const { user, signInWithGoogle } = useAuth();
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const isUpdatingFromRemote = useRef(false);

  // Draw arrow helper
  const drawArrow = useCallback((context, x1, y1, x2, y2, arrowColor, width) => {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    context.strokeStyle = arrowColor;
    context.fillStyle = arrowColor;
    context.lineWidth = width;

    // Line
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();

    // Arrow head
    context.beginPath();
    context.moveTo(x2, y2);
    context.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    context.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    context.closePath();
    context.fill();
  }, []);

  // Draw single element
  const drawElement = useCallback((context, element) => {
    if (!context) return;

    context.strokeStyle = element.color;
    context.fillStyle = element.color;
    context.lineWidth = element.strokeWidth;

    switch (element.type) {
      case 'pen':
        if (element.points && element.points.length > 1) {
          context.beginPath();
          context.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length; i++) {
            context.lineTo(element.points[i].x, element.points[i].y);
          }
          context.stroke();
        }
        break;

      case 'line':
        context.beginPath();
        context.moveTo(element.x1, element.y1);
        context.lineTo(element.x2, element.y2);
        context.stroke();
        break;

      case 'arrow':
        drawArrow(context, element.x1, element.y1, element.x2, element.y2, element.color, element.strokeWidth);
        break;

      case 'rectangle':
        context.beginPath();
        context.strokeRect(element.x, element.y, element.width, element.height);
        break;

      case 'circle':
        context.beginPath();
        context.ellipse(
          element.x + element.width / 2,
          element.y + element.height / 2,
          Math.abs(element.width / 2),
          Math.abs(element.height / 2),
          0, 0, Math.PI * 2
        );
        context.stroke();
        break;

      case 'diamond': {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        context.beginPath();
        context.moveTo(cx, element.y);
        context.lineTo(element.x + element.width, cy);
        context.lineTo(cx, element.y + element.height);
        context.lineTo(element.x, cy);
        context.closePath();
        context.stroke();
        break;
      }

      case 'text':
        context.font = `${element.fontSize || 16}px Inter, sans-serif`;
        context.fillText(element.text, element.x, element.y);
        break;

      case 'eraser':
        if (element.points && element.points.length > 1) {
          context.strokeStyle = '#FFFFFF';
          context.lineWidth = element.strokeWidth * 3;
          context.beginPath();
          context.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length; i++) {
            context.lineTo(element.points[i].x, element.points[i].y);
          }
          context.stroke();
        }
        break;

      default:
        break;
    }
  }, [drawArrow]);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    if (!ctx || !canvasRef.current) return;

    const canvas = canvasRef.current;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    const gridSize = 20 * scale;
    for (let x = offset.x % gridSize; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offset.y % gridSize; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw elements
    elements.forEach(element => drawElement(ctx, element));

    // Draw current element being drawn
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  }, [ctx, elements, currentElement, scale, offset, drawElement]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setCtx(context);
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      redrawCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ctx, redrawCanvas]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Get mouse position
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  };

  // Mouse down handler
  const handleMouseDown = (e) => {
    if (!isAdmin) return;

    const pos = getMousePos(e);
    setStartPos(pos);
    setIsDrawing(true);

    if (tool === TOOLS.PAN) {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === TOOLS.TEXT) {
      setTextPosition(pos);
      setShowTextInput(true);
      return;
    }

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      setCurrentElement({
        type: tool,
        points: [pos],
        color,
        strokeWidth,
      });
    } else if (tool === TOOLS.LINE || tool === TOOLS.ARROW) {
      setCurrentElement({
        type: tool,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        color,
        strokeWidth,
      });
    } else if (tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE || tool === TOOLS.DIAMOND) {
      setCurrentElement({
        type: tool,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color,
        strokeWidth,
      });
    }
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    if (!isAdmin) return;

    if (isPanning) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing || !currentElement) return;

    const pos = getMousePos(e);

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      setCurrentElement(prev => ({
        ...prev,
        points: [...prev.points, pos],
      }));
    } else if (tool === TOOLS.LINE || tool === TOOLS.ARROW) {
      setCurrentElement(prev => ({
        ...prev,
        x2: pos.x,
        y2: pos.y,
      }));
    } else if (tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE || tool === TOOLS.DIAMOND) {
      setCurrentElement(prev => ({
        ...prev,
        width: pos.x - startPos.x,
        height: pos.y - startPos.y,
      }));
    }
  };

  // Sync to Firebase
  const syncToFirebase = useCallback((elementsToSync) => {
    if (!isAdmin) return;

    if (window.whiteboardTimeout) {
      clearTimeout(window.whiteboardTimeout);
    }

    window.whiteboardTimeout = setTimeout(() => {
      const data = {
        elements: elementsToSync,
        timestamp: Date.now(),
      };
      updateWhiteboard(JSON.stringify(data));
    }, 200);
  }, [isAdmin, updateWhiteboard]);

  // Add to history
  const addToHistory = useCallback((newElements) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newElements);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!isAdmin) return;

    setIsDrawing(false);
    setIsPanning(false);

    if (currentElement) {
      const newElements = [...elements, { ...currentElement, id: Date.now() }];
      setElements(newElements);
      addToHistory(newElements);
      setCurrentElement(null);
      syncToFirebase(newElements);
    }
  }, [isAdmin, currentElement, elements, addToHistory, syncToFirebase]);

  // Add text
  const handleAddText = () => {
    if (!textInput.trim() || !textPosition) return;

    const newElement = {
      id: Date.now(),
      type: 'text',
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      color,
      fontSize: strokeWidth * 4,
      strokeWidth,
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    addToHistory(newElements);
    setTextInput('');
    setShowTextInput(false);
    setTextPosition(null);
    syncToFirebase(newElements);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newElements = history[newIndex];
      setElements(newElements);
      syncToFirebase(newElements);
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newElements = history[newIndex];
      setElements(newElements);
      syncToFirebase(newElements);
    }
  };

  // Clear canvas
  const clearCanvas = () => {
    setElements([]);
    addToHistory([]);
    syncToFirebase([]);
  };

  // Sync from Firebase for non-admin users
  useEffect(() => {
    if (!whiteboardData) return;

    if (!isAdmin) {
      try {
        isUpdatingFromRemote.current = true;
        const data = JSON.parse(whiteboardData);
        setElements(data.elements || []);
        setTimeout(() => {
          isUpdatingFromRemote.current = false;
        }, 100);
      } catch (error) {
        console.error('Error parsing whiteboard data:', error);
        isUpdatingFromRemote.current = false;
      }
    }
  }, [whiteboardData, isAdmin]);

  // Initialize from Firebase on load
  useEffect(() => {
    if (whiteboardData) {
      try {
        const data = JSON.parse(whiteboardData);
        if (data.elements && data.elements.length > 0 && elements.length === 0) {
          setElements(data.elements);
          setHistory([data.elements]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error('Error initializing whiteboard:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteboardData]);

  // Download as PNG
  const downloadAsPNG = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Save to Firebase
  const saveToFirebase = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (!saveTitle.trim()) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'savedWhiteboards'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        meetingId,
        title: saveTitle.trim(),
        elements,
        createdAt: serverTimestamp(),
        thumbnail: canvasRef.current.toDataURL('image/png', 0.3),
      });
      setShowSaveModal(false);
      setSaveTitle('');
      alert('Whiteboard saved successfully!');
    } catch (error) {
      console.error('Error saving whiteboard:', error);
      alert('Failed to save whiteboard. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Tool button component
  // eslint-disable-next-line no-unused-vars
  const ToolButton = ({ toolType, icon: Icon, label }) => (
    <button
      onClick={() => setTool(toolType)}
      className={`p-2.5 rounded-lg transition-all ${
        tool === toolType
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Tool Selection */}
          <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg">
            <ToolButton toolType={TOOLS.SELECT} icon={MousePointer} label="Select" />
            <ToolButton toolType={TOOLS.PEN} icon={Pencil} label="Pen" />
            <ToolButton toolType={TOOLS.ERASER} icon={Eraser} label="Eraser" />
          </div>

          <div className="w-px h-8 bg-gray-200" />

          {/* Shape Tools */}
          <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg">
            <ToolButton toolType={TOOLS.LINE} icon={Minus} label="Line" />
            <ToolButton toolType={TOOLS.ARROW} icon={ArrowRight} label="Arrow" />
            <ToolButton toolType={TOOLS.RECTANGLE} icon={Square} label="Rectangle" />
            <ToolButton toolType={TOOLS.CIRCLE} icon={Circle} label="Circle" />
            <ToolButton toolType={TOOLS.DIAMOND} icon={Diamond} label="Diamond" />
          </div>

          <div className="w-px h-8 bg-gray-200" />

          {/* Text Tool */}
          <ToolButton toolType={TOOLS.TEXT} icon={Type} label="Text" />

          <div className="w-px h-8 bg-gray-200" />

          {/* Pan Tool */}
          <ToolButton toolType={TOOLS.PAN} icon={Move} label="Pan" />
        </div>

        {/* Middle Section - Color & Stroke */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            {/* Color Picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-md border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <Palette className="w-4 h-4 text-gray-500" />
              </button>

              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="grid grid-cols-4 gap-2 w-40">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setColor(c);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                            color === c ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full h-8 cursor-pointer rounded"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`p-2 rounded-lg transition-colors ${
                    strokeWidth === w
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                  title={`Stroke width: ${w}px`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: w + 4, height: w + 4 }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo"
              >
                <Undo className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo"
              >
                <Redo className="w-5 h-5 text-gray-600" />
              </button>

              <div className="w-px h-8 bg-gray-200" />

              <button
                onClick={clearCanvas}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                title="Clear Canvas"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="w-px h-8 bg-gray-200" />

          {/* Download */}
          <button
            onClick={downloadAsPNG}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Download as PNG"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>

          {/* Save to Firebase */}
          {isAdmin && (
            <button
              onClick={() => user ? setShowSaveModal(true) : signInWithGoogle()}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Save to Cloud"
            >
              <Save className="w-4 h-4" />
              <span className="text-sm font-medium">Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {isAdmin ? (
            <div className="flex items-center gap-2 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Drawing Mode</span>
              <span className="text-gray-400">- All participants can see your drawings</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="font-medium">View Only</span>
              <span className="text-gray-400">- Only host can draw</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-gray-500">
          <span>{elements.length} elements</span>
          <span>Zoom: {Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef} 
        className="flex-1 relative overflow-hidden bg-gray-50"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`absolute inset-0 ${
            tool === TOOLS.PAN ? 'cursor-grab' : 
            tool === TOOLS.TEXT ? 'cursor-text' : 
            tool === TOOLS.ERASER ? 'cursor-cell' :
            'cursor-crosshair'
          } ${isPanning ? 'cursor-grabbing' : ''}`}
          style={{ touchAction: 'none' }}
        />

        {/* Text Input Modal */}
        {showTextInput && textPosition && (
          <div
            className="absolute z-20"
            style={{ left: textPosition.x, top: textPosition.y }}
          >
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                placeholder="Type your text..."
                className="w-64 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleAddText}
                  className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  Add Text
                </button>
                <button
                  onClick={() => {
                    setShowTextInput(false);
                    setTextInput('');
                    setTextPosition(null);
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Minus className="w-4 h-4 text-gray-600" />
          </button>
          <span className="px-2 text-sm text-gray-600 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Save Whiteboard</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {user ? (
              <>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{user.displayName}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="Enter a title for your whiteboard..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveToFirebase}
                    disabled={saving || !saveTitle.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">Sign in with Google to save your whiteboard</p>
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" />
                  <span className="font-medium">Sign in with Google</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
