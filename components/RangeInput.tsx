import React from 'react';

interface RangeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueLabel?: React.ReactNode;
}

const RangeInput: React.FC<RangeInputProps> = ({ label, valueLabel, ...props }) => {
  return (
    <div>
      {(label || valueLabel) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-[10px] text-slate-500">{label}</span>}
          {valueLabel && <span className="text-[10px] font-mono text-indigo-600">{valueLabel}</span>}
        </div>
      )}
      <input 
        type="range"
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        {...props}
      />
    </div>
  );
};

export default RangeInput;
