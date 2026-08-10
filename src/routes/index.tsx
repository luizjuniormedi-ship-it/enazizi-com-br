import React from 'react';

const RouteIndex = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8 font-mono">
      <div className="max-w-2xl w-full space-y-4 text-center">
        <h1 className="text-xl font-black tracking-tight text-red-500 uppercase">
          Verificação de Sistema
        </h1>
        <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl">
          <p className="text-sm tracking-widest opacity-80 uppercase">
            QUE IAS ESTAO CONFIGURADAS
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteIndex;
