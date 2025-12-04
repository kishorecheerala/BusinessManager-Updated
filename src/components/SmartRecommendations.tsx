
import React from 'react';
import { useRecommendations } from '../hooks/useRecommendations';
import Card from './Card';
import { ArrowRight, Lightbulb } from 'lucide-react';

export const SmartRecommendations: React.FC = () => {
  const recommendations = useRecommendations();

  if (!recommendations.length) return null;

  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-100 dark:border-indigo-800/30">
      <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-yellow-400 text-white rounded-full shadow-sm">
              <Lightbulb size={16} />
          </div>
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Recommended Actions</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec: any, idx: number) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
                <div className="text-2xl mb-2">{rec.icon}</div>
                <div className="font-bold text-sm text-slate-800 dark:text-white mb-1">{rec.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{rec.description}</div>
            </div>
            <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all self-start">
                {rec.action} <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
};
