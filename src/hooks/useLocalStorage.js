import { useState, useEffect } from 'react';

function useLocalStorage(key, initialValue) {
  // 1. Inicializar estado con función perezosa (lazy initialization)
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error leyendo localStorage clave "${key}":`, error);
      return initialValue;
    }
  });

  // 2. Escuchar cambios y guardar, manejando errores
  const setValue = (value) => {
    try {
      // Permitir que value sea una función (como useState normal)
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error guardando en localStorage clave "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

export default useLocalStorage;