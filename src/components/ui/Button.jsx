import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({ children, onClick, disabled, loading, variant = 'primary', className = "" }) => {
    const baseStyle = "w-full font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600",
        danger: "bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400"
    };

    return (
        <button 
            onClick={onClick} 
            disabled={disabled || loading} 
            className={`${baseStyle} ${variants[variant]} ${className}`}
        >
            {loading && <Loader2 className="animate-spin w-4 h-4" />}
            {children}
        </button>
    );
};

export default Button;