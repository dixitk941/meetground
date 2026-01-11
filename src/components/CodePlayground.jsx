import { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useMeeting } from '../context/MeetingContext';
import { Play, ChevronDown, Loader2 } from 'lucide-react';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts' },
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
  { id: 'csharp', name: 'C#', extension: 'cs' },
  { id: 'go', name: 'Go', extension: 'go' },
  { id: 'rust', name: 'Rust', extension: 'rs' },
  { id: 'php', name: 'PHP', extension: 'php' },
  { id: 'ruby', name: 'Ruby', extension: 'rb' },
  { id: 'html', name: 'HTML', extension: 'html' },
  { id: 'css', name: 'CSS', extension: 'css' },
  { id: 'json', name: 'JSON', extension: 'json' },
  { id: 'sql', name: 'SQL', extension: 'sql' },
];

const DEFAULT_CODE = {
  javascript: `// Welcome to MeetGround Code Playground!
// Write and share code in real-time

function greet(name) {
  return \`Hello, \${name}! Welcome to the meeting.\`;
}

console.log(greet('World'));
`,
  python: `# Welcome to MeetGround Code Playground!
# Write and share code in real-time

def greet(name):
    return f"Hello, {name}! Welcome to the meeting."

print(greet("World"))
`,
  typescript: `// Welcome to MeetGround Code Playground!
// Write and share code in real-time

function greet(name: string): string {
  return \`Hello, \${name}! Welcome to the meeting.\`;
}

console.log(greet('World'));
`,
  java: `// Welcome to MeetGround Code Playground!
// Write and share code in real-time

public class Main {
    public static void main(String[] args) {
        System.out.println(greet("World"));
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "! Welcome to the meeting.";
    }
}
`,
};

const CodePlayground = () => {
  const { codeData, updateCode, isAdmin } = useMeeting();
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [output, setOutput] = useState('');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const isUpdatingFromRemote = useRef(false);
  const pyodideRef = useRef(null);

  // Load Pyodide when Python is selected
  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) return pyodideRef.current;
    
    setIsPyodideLoading(true);
    setOutput('⏳ Loading Python environment...');
    
    try {
      // Load Pyodide from CDN
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
      });
      
      pyodideRef.current = pyodide;
      setOutput('✅ Python environment ready! Click "Run" to execute.');
      return pyodide;
    } catch (error) {
      console.error('Failed to load Pyodide:', error);
      setOutput('❌ Failed to load Python environment. Please refresh and try again.');
      return null;
    } finally {
      setIsPyodideLoading(false);
    }
  }, []);

  // Initialize and sync code from Firebase
  useEffect(() => {
    if (codeData) {
      // For non-admin users, always sync from Firebase
      if (!isAdmin) {
        setLanguage(codeData.language || 'javascript');
        setCode(codeData.code || DEFAULT_CODE[codeData.language] || '');
      } else {
        // For admin, only sync on initial load
        if (!isUpdatingFromRemote.current && code === DEFAULT_CODE.javascript) {
          setLanguage(codeData.language || 'javascript');
          setCode(codeData.code || DEFAULT_CODE[codeData.language] || '');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeData, isAdmin]);

  // Handle code changes with debounce
  const handleCodeChange = useCallback(
    (value) => {
      setCode(value);
      
      if (!isAdmin) return;
      
      isUpdatingFromRemote.current = true;
      
      if (window.codeTimeout) {
        clearTimeout(window.codeTimeout);
      }
      window.codeTimeout = setTimeout(() => {
        updateCode({ language, code: value });
        setTimeout(() => {
          isUpdatingFromRemote.current = false;
        }, 100);
      }, 300);
    },
    [isAdmin, language, updateCode]
  );

  // Handle language change
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    const newCode = DEFAULT_CODE[newLanguage] || `// ${newLanguage} code`;
    setCode(newCode);
    setShowLanguageMenu(false);
    
    if (isAdmin) {
      updateCode({ language: newLanguage, code: newCode });
    }
  };

  // Run code (JavaScript or Python)
  const runCode = async () => {
    if (language !== 'javascript' && language !== 'python') {
      setOutput('⚠️ Only JavaScript and Python can be executed in the browser.\nFor other languages, use an external compiler.');
      return;
    }

    setIsRunning(true);
    setOutput('');

    try {
      if (language === 'python') {
        // Run Python code using Pyodide
        let pyodide = pyodideRef.current;
        if (!pyodide) {
          pyodide = await loadPyodide();
          if (!pyodide) {
            setIsRunning(false);
            return;
          }
        }

        // Redirect stdout and stderr
        pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

        try {
          // Execute the Python code
          pyodide.runPython(code);
          
          // Get the output
          const stdout = pyodide.runPython('sys.stdout.getvalue()');
          const stderr = pyodide.runPython('sys.stderr.getvalue()');
          
          let outputText = stdout;
          if (stderr) {
            outputText += (outputText ? '\n' : '') + '⚠️ ' + stderr;
          }
          setOutput(outputText || '(No output)');
        } catch (pyError) {
          setOutput(`❌ Python Error: ${pyError.message}`);
        } finally {
          // Reset stdout and stderr for next run
          pyodide.runPython(`
sys.stdout = StringIO()
sys.stderr = StringIO()
`);
        }
      } else {
        // Run JavaScript code
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        // Execute code
        const result = new Function(code)();
        
        // Restore console.log
        console.log = originalLog;

        // Show output
        let outputText = logs.join('\n');
        if (result !== undefined) {
          outputText += (outputText ? '\n' : '') + '→ ' + String(result);
        }
        setOutput(outputText || '(No output)');
      }
    } catch (error) {
      setOutput(`❌ Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-black">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-[#222222]">
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => isAdmin && setShowLanguageMenu(!showLanguageMenu)}
              disabled={!isAdmin}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                isAdmin 
                  ? 'bg-[#1a1a1a] hover:bg-[#222222] border border-[#222222]' 
                  : 'bg-[#111111] opacity-60 cursor-not-allowed'
              } text-white text-sm transition-colors`}
            >
              <span>{LANGUAGES.find(l => l.id === language)?.name || 'JavaScript'}</span>
              {isAdmin && <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showLanguageMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLanguageMenu(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl py-1 min-w-[160px] z-50 max-h-60 overflow-y-auto">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => handleLanguageChange(lang.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#1a1a1a] transition-colors ${
                        language === lang.id ? 'text-white bg-[#1a1a1a]' : 'text-gray-400'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-2 px-2 py-1 bg-[#111111] rounded-lg border border-[#222222]">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
              <span className="text-yellow-500 text-xs">View only</span>
            </div>
          )}
        </div>

        {/* Run Button */}
        <button
          onClick={runCode}
          disabled={isRunning || isPyodideLoading || (language !== 'javascript' && language !== 'python')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg ${
            language === 'javascript' || language === 'python'
              ? 'bg-white text-black hover:bg-gray-100'
              : 'bg-[#111111] text-gray-500 cursor-not-allowed'
          } text-sm font-medium transition-colors`}
        >
          {(isRunning || isPyodideLoading) ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span>
            {isPyodideLoading 
              ? 'Loading Python...' 
              : isRunning 
                ? 'Running...' 
                : 'Run'}
          </span>
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 flex">
        <div className="flex-1 border-r border-[#222222]">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              readOnly: !isAdmin,
              minimap: { enabled: false },
              fontSize: 13,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>

        {/* Output Panel */}
        <div className="w-80 flex flex-col bg-[#0a0a0a]">
          <div className="px-4 py-2.5 border-b border-[#222222]">
            <span className="text-white text-sm font-medium">Output</span>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <pre className="text-sm text-gray-400 whitespace-pre-wrap font-mono">
              {output || (
                <span className="text-gray-600">
                  Click "Run" to execute JavaScript
                </span>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePlayground;
