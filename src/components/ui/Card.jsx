import React from 'react';

const Card = ({ children, className = "", noPadding = false }) => {
    return (
        <div className={`glass-panel rounded-3xl relative overflow-hidden animate-fade-in ${noPadding ? 'p-0' : 'p-6'} ${className}`}>
            {children}
        </div>
    );
};

export default Card;