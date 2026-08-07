import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, User } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { MachineRequirementSummary, LineMachineMatrixRow } from '../../types/mrp';

interface IEAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: MachineRequirementSummary[];
  lineMatrix: LineMachineMatrixRow[];
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const IEAssistantModal: React.FC<IEAssistantModalProps> = ({
  isOpen,
  onClose,
  summaryData,
  lineMatrix,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello Industrial Engineer! I am your AI MRP Optimization Adviser. I have analyzed your current production schedule across ${
        lineMatrix.length
      } line(s) and ${summaryData.length} sewing machine types.\n\n${
        summaryData.some((s) => s.gap < 0)
          ? `⚠️ I detected shortages in ${
              summaryData.filter((s) => s.gap < 0).length
            } machine type(s): ${summaryData
              .filter((s) => s.gap < 0)
              .map((s) => `${s.machine} (Deficit: ${Math.abs(s.gap)})`)
              .join(', ')}.`
          : '✅ All sewing machine types currently have balanced or surplus inventory.'
      }\n\nAsk me anything about machine line balancing, shortage mitigation, or floor layout optimization!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      // Build context from current live MRP calculations
      const shortageList = summaryData
        .filter((s) => s.gap < 0)
        .map((s) => `${s.machine} (Required: ${s.required}, Avail: ${s.available}, Gap: ${s.gap})`)
        .join('; ');
      const surplusList = summaryData
        .filter((s) => s.gap > 0)
        .map((s) => `${s.machine} (Surplus: +${s.gap})`)
        .join('; ');

      const contextPrompt = `
You are an expert Industrial Engineering (IE) Garment Manufacturing Consultant specializing in Sewing Machine Requirement Planning (MRP), Line Balancing, and Production Optimization.
Here is the current plant machine status:
- Active Lines: ${lineMatrix.length}
- Shortage Machines: ${shortageList || 'None'}
- Surplus Machines: ${surplusList || 'None'}

User Question: "${textToSend}"

Please provide a clear, structured, actionable Industrial Engineering recommendation formatted in markdown with bullet points. Focus on real garment manufacturing techniques (buffer inventory borrowing, operator multi-skilling, workstation layout changes, or preventative maintenance timing).`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        // Intelligent fallback IE response if key is missing
        await new Promise((resolve) => setTimeout(resolve, 800));
        let reply = '';
        if (shortageList) {
          reply = `### ⚙️ IE Shortage Mitigation Strategy\n\nBased on your current deficit in **${shortageList}**:\n\n1. **Immediate Floor Action**: Re-allocate idle surplus machines from inactive lines or central buffer inventory.\n2. **Line Balancing Option**: For operations using **Bartack** or **Flatlock**, check if adjacent stations can share a single machine via **operator balance grouping** (e.g., Operator 1 and Operator 2 sharing 1 Bartack machine during non-overlapping cycle times).\n3. **Rental / Maintenance Priority**: Contact mechanical maintenance immediately to verify if any machines in the workshop repair queue can be prioritized for floor release today.`;
        } else {
          reply = `### 🟢 Plant Capacity & Line Balance Optimization\n\nYour sewing machine inventory is currently well-balanced across all ${lineMatrix.length} active lines!\n\n1. **Preventive Maintenance Window**: Use your surplus capacity (${surplusList}) to rotate machines into the maintenance workshop without halting line production.\n2. **Changeover Prep**: Ensure spare **SN** and **OL4** heads are pre-set with correct needle sizes and thread tensions for tomorrow's scheduled style changeovers.`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contextPrompt,
      });

      const replyText =
        response.text || 'I have analyzed the schedule. Please review your surplus buffer machines.';
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: '⚠️ Unable to reach Gemini AI at the moment. However, I recommend inspecting your machine shortages and reallocating buffer units from idle lines.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full h-[600px] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 transition-colors">
        {/* Modal Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                AI Industrial Engineering Optimization Adviser
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Powered by Gemini &bull; Real-time Line Balancing &amp; Shortage Analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto text-xs transition-colors">
          <span className="text-slate-500 dark:text-slate-400 shrink-0 font-medium">IE Presets:</span>
          <button
            onClick={() =>
              handleSendMessage(
                'How can we mitigate the current sewing machine shortages without purchasing new machines?'
              )
            }
            className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shrink-0 transition-colors"
          >
            Mitigate Current Shortages
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                'Give recommendations for line balancing across Line G01, G02, and G03.'
              )
            }
            className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shrink-0 transition-colors"
          >
            Line Balancing Recommendations
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                'What is the best preventative maintenance schedule for high-utilization machines (>95%)?'
              )
            }
            className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0 transition-colors"
          >
            Maintenance Tips
          </button>
        </div>

        {/* Messages list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed transition-colors ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none whitespace-pre-wrap shadow-sm'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[10px] mt-1.5 text-right transition-colors ${
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {msg.time}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 text-xs transition-colors">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition-colors">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <span className="italic">Analyzing OB IE and machine balance...</span>
            </div>
          )}
        </div>

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2 transition-colors"
        >
          <input
            type="text"
            placeholder="Ask AI about machine allocation, bottlenecks, or line setup..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 disabled:opacity-50 shadow-inner transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
